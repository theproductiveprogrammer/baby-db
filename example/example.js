'use strict'
const littledb = require('..')
const path = require('path')

const USERS = {}

const userdb = littledb(path.join(__dirname, 'users.db'))

let numerrs = 0
userdb.on('error', err => {
  numerrs++
  console.error(err)
})

userdb.on('rec', (rec, num) => {
  switch(rec.type) {
    case 'new':
      USERS[rec.userid] = rec.info
      break
    case 'update':
      if(!USERS[rec.userid]) throw `Cannot update non-existent record on line: ${num}`
      Object.assign(USERS[rec.userid], rec.info)
      break
    case 'delete':
      delete USERS[rec.userid]
      break
    default:
      throw `Did not understand record type: "${rec.type}", on line: ${num}`
  }
})
userdb.on('done', () => {
  console.log()
  console.log('******')
  console.log('Users loaded', JSON.stringify(USERS, 0, 2))
  if(numerrs) console.log(`FOUND ${numerrs} errors!`)
  console.log("ready to rumble....!")
})
