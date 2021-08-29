'use strict'
const badb = require('..')
const path = require('path')

const logdb = badb(path.join(__dirname, 'logs', 'log.db'), {
  saveEvery: 100,
  maxRecsEvery: 10,
  parseJSON: false, // Logs are not JSON
})
logdb.on('error', err => console.error(err))
logdb.on('rec', (rec, num) => console.log(rec,num))
logdb.on('done', () => {
  console.log('logs loaded')
  logdb.add("Testing Testing")
  logdb.add("123")
  logdb.add("Testing Testing")
  logdb.add("123")
  logdb.add("Testing Testing")
  logdb.add("123")
  logdb.add("The End")
})

const USERS = {}

const userdb = badb(path.join(__dirname, 'db', 'users.db'), {
  loadOnStart: false,
  saveEvery: 100,
  maxRecsEvery: 10,
})

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
  console.log('userdb loaded')
  all_done_msg()
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
userdb.on('stopped', () => console.log("userdb stopped"))

userdb.onExitSignal(() => all_exited('userdb'))

userdb.load()
userdb.load()

const proddb = badb(path.join(__dirname, 'products.db'))
proddb.on('error', err => console.error(err))
proddb.on('rec', (rec, num) => console.log(rec,num))
proddb.on('done', () => {
  console.log('products loaded')
  proddb.add({ name: "iPhone" })
  proddb.add({ name: "Tesla" })
  proddb.add({ name: "The Complete Works of William Shakespear" })
  proddb.add({ name: "The Incomplete Works of Billy Boy" })
  proddb.add({ name: "Doughnuts" })
  all_done_msg()
})
proddb.on('stopped', () => console.log("proddb stopped"))
proddb.onExitSignal(() => all_exited('proddb'))

let num_done = 0
function all_done_msg() {
  num_done++
  if(num_done === badb.numdb()) console.log(`All databases loaded!`)
}

let num_exit = 0
function all_exited(name) {
  console.log(`${name} exit done...`)
  num_exit++
  if(num_exit !== badb.numdb()) return
  console.log("All DB's stopped")
  process.exit()
}
