'use strict'
const badb = require('..')
const path = require('path')

const USERS = {}

const userdb = badb(path.join(__dirname, 'users.db'))

let numerrs = 0
userdb.on('error', err => {
  if(err === 'overflow') return
  numerrs++
  console.error(err)
})

let userid = 0
userdb.on('rec', (rec, num) => {
  switch(rec.type) {
    case 'new':
      userid = Math.max(rec.userid, userid)
      USERS[rec.userid] = rec.info
      break
    case 'update':
      if(!USERS[rec.userid]) throw `Cannot update non-existent record on line: ${num}`
      Object.assign(USERS[rec.userid], rec.info)
      break
    case 'delete':
      delete USERS[rec.userid]
      break
    case 'ignore': break;
    default:
      throw `Did not understand record type: "${rec.type}", on line: ${num}`
  }
})
userdb.on('done', () => {
  console.log()
  let loaderrs = numerrs

  const jack = ++userid;
  userdb.add({ type: 'new', userid: jack, info: { name: 'jack', mood: 'annoyed'}})
  userdb.add({ type: 'update', userid: jack, info: { mood: 'really annoyed'}})
  userdb.add({ type: 'delete', userid: userid})

  const jill = ++userid;
  userdb.add({ type: 'new', userid: jill, info: { name: 'jill', mood: 'sleepy'}})
  userdb.add({ type: 'update', userid: jill, info: { mood: 'hungry'}})

  for(let i = 0;i < 10000;i++) {
    userdb.add({ type: 'ignore', userid: i+1000, info: {}})
  }

  console.log('waiting 5 seconds to add james...')
  setTimeout(() => {
    const james = ++userid;
    userdb.add({ type: 'new', userid: james, info: { name: 'james', mood: 'productive'}})
    userdb.add({ type: 'update', userid: james, info: { mood: 'zapped-out'}})

    console.log('******')
    console.log('Users loaded', JSON.stringify(USERS, 0, 2))
    if(loaderrs) console.log(`FOUND ${loaderrs} errors!`)
    console.log("ready to rumble....!")

  }, 5000)


})
userdb.on('overflow', rec => {
  console.error('overflow record', rec)
})

userdb.onExitSignal(() => process.exit())
