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
  let stopped = false

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

    try {
      linenum++
      db.emit('rec', rec, linenum)
    } catch(err) {
      db.emit('error', err)
    }
  }


  function save(rec) {
    const line = JSON.stringify(rec) + '\n'
    if(stopped) throw `DB ${file} stopped. Cannot save ${line}`
    saveBuffer.push(line)
    if(!savetimer) {
      savetimer = setTimeout(() => persist(() => savetimer = 0), options.saveEvery)
    }
  }

  function saveNow(cb) {
    if(saving) return
    saving = true
    let data = ""
    for(let i = 0;i < saveBuffer.length;i++) data += saveBuffer[i]
    saveBuffer = []
    try {
      fs.appendFileSync(file, data)
      saving = false
      cb()
    } catch(err) {
      db.emit('error', err)
      cb(err)
    }
  }

  function stop(cb) {
    stopped = true
    saveNow(cb)
  }

  function onExitSignal(cb) {
    process.on('SIGINT', () => stop(cb))
    process.on('SIGTERM', () => stop(cb))
    process.on('SIGBREAK', () => stop(cb))
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
  db.stop = stop
  db.onExitSignal = onExitSignal

  return db
}
