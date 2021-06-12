'use strict'
const EventEmitter = require('events')
const fs = require('fs')
const readline = require('readline')

class BabyDB extends EventEmitter {}


module.exports = file => {
  const db = new BabyDB()
  let options = {
    saveEvery: 3000
  }
  let linenum = 0
  let saveBuffer = []
  let savetimer
  let saving = false

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

    const rl = readline.createInterface({ input, crlfDelay: Infinity })
    rl.on('line', line => {
      linenum++
      if(!line) return
      line = line.trim()
      if(!line) return

      let rec
      try {
        rec = JSON.parse(line)
      } catch(err) {
        db.emit('error', `Failed parsing ${file}:${linenum}:${line}`)
        return
      }

      try {
        db.emit('rec', rec, linenum)
      } catch(err) {
        db.emit('error', err)
      }

    })
  }

  function add(rec) {
    try {
      save(rec)
    } catch(err) {
      db.emit('error', err)
      return
    }

    linenum++
    db.emit('rec', rec, linenum)
  }


  function save(rec) {
    saveBuffer.push(JSON.stringify(rec) + '\n')
    if(!savetimer) {
      savetimer = setTimeout(() => persist(() => savetimer = 0), options.saveEvery)
    }
  }


  function persist(cb) {
    saving = true
    p_1(0)

    function p_1(ndx) {
      if(ndx >= saveBuffer.length) {
        saving = false
        saveBuffer = []
        return cb()
      }
      let data = ""
      for(;ndx < saveBuffer.length;ndx++) data += saveBuffer[ndx]
      fs.appendFile(file, data, err => {
        if(err) db.emit('error', err)
        p_1(ndx+1)
      })
    }
  }

  load()

  db.add = add

  return db
}
