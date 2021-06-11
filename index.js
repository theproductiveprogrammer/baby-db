'use strict'
const EventEmitter = require('events')
const fs = require('fs')
const readline = require('readline')

class BabyDB extends EventEmitter {}


module.exports = file => {
  const db = new BabyDB()

  /*    way/
   * stream in the file, line-by-line, and process each line as a record
   */
  function load() {
    const input = fs.createReadStream(file)
    input.on('error', err => {
      if(err.code === 'ENOENT') db.emit('done')
      else db.emit('error', err)
    })
    input.on('end', () => db.emit('done'))

    let num = 0
    const rl = readline.createInterface({ input, crlfDelay: Infinity })
    rl.on('line', line => {
      num++
      if(!line) return
      line = line.trim()
      if(!line) return

      let rec
      try {
        rec = JSON.parse(line)
      } catch(err) {
        db.emit('error', `Failed parsing ${file}:${num}:${line}`)
      }
      if(!rec) return

      try {
        db.emit('rec', rec, num)
      } catch(err) {
        db.emit('error', err)
      }

    })
  }

  load()

  return db
}
