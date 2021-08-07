'use strict'
const EventEmitter = require('events')
const fs = require('fs')
const path = require('path')
const readline = require('readline')

/*    understand/
 * BabyDB is an event emitter which is a nice way of setting up a  database
 */
class BabyDB extends EventEmitter {}


/*    understand/
 * keep track of all databases just so we can do stuff like stop them
 * all on exit etc
 */
const DBS = []
function numdb() { return DBS.length }
/*    understand/
 * stop all the DB's we are managing, invoking the callback
 * when they all have stopped
 */
function stopAll(cb) {
  let num_stopped = 0
  DBS.map(db => db.stop(() => {
    num_stopped++
    if(num_stopped == numdb()) {
      cb && cb()
    }
  }))
}
/*    understand/
 * handle common exit signals to ensure the best chance of persistence
 * invoking the callback once
 */
function onExitSignal(cb) {
  let callback_called = false
  process.on('SIGINT', () => stopAll(cb_1))
  process.on('SIGTERM', () => stopAll(cb_1))
  process.on('SIGBREAK', () => stopAll(cb_1))

  function cb_1() {
    if(callback_called) return
    callback_called = true
    cb && cb()
  }
}




function newDB(file, opts) {
  const db = new BabyDB()
  DBS.push(db)

  let options = Object.assign({
    loadOnStart: true,

    saveEvery: 3000,
    maxRecsEvery: 3072,   /* 3072 records every 3 seconds */
  }, opts)

  let linenum = 0
  let saveBuffer = []
  let savetimer
  let saving = false
  let stopped = false
  let loaded = false

  /*    way/
   * stream in the file, line-by-line, and process each line as a record
   */
  function load() {
    if(loaded) return
    loaded = true

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

  /*    way/
   * save the record then pass it on for processing
   */
  function add(rec) {
    if(options.maxRecsEvery && saveBuffer.length > options.maxRecsEvery) {
      db.emit('overflow', rec)
      db.emit('error', 'overflow', rec)
      return
    }

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


  /*    way/
   * we perist the record periodically as a JSON encoded line
   * NB: If JSON encoding fails we expect the add function to
   * report the error to the user
   */
  function save(rec) {
    const line = JSON.stringify(rec) + '\n'
    if(stopped) throw `DB ${file} stopped. Cannot save ${line}`
    saveBuffer.push(line)
    if(!savetimer) {
      savetimer = setTimeout(() => persist(() => savetimer = 0), options.saveEvery)
    }
  }

  /*    understand/
   * we use this to save immediately. Useful for signal handler
   * and when stopping/exiting
   */
  function saveNow(cb) {
    if(saving) return
    saving = true
    let data = ""
    for(let i = 0;i < saveBuffer.length;i++) data += saveBuffer[i]
    saveBuffer = []
    try {
      fs.appendFileSync(file, data)
      saving = false
      cb && cb()
    } catch(err) {
      db.emit('error', err)
      cb && cb(err)
    }
  }

  /*    understand/
   * we stop the db and save whatever we have right away
   */
  function stop(cb) {
    if(stopped) {
      cb && cb()
      return
    }
    stopped = true
    saveNow(() => {
      db.emit('stopped')
      cb && cb()
    })
  }

  /*    way/
   * persist the data to disk by creating a string of all the
   * pending records in the buffer and appending them to the
   * db file
   *
   *    understand/
   * during the persistence it is possible we will get more records as
   * the user calls `add()`. Therefore we keep track of what we have
   * read and don't stop writing until the buffer is actually empty.
   */
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

  /*    way/
   * ensure the path to the database exists
   */
  if(!fs.existsSync(file)) {
    const loc = path.dirname(file)
    if(!fs.existsSync(loc)) fs.mkdirSync(loc, { recursive: true })
    fs.closeSync(fs.openSync(file, 'a'))
  }

  /*    way/
   * We add properties so we can write simpler class methods
   */
  db.load = load
  db.add = add
  db.stop = stop
  db.numdb = numdb
  db.numdbs = numdb
  db.onExitSignal = onExitSignal

  /*    understand
   * we auto load the data on construction
   */
  if(options.loadOnStart) load()

  return db
}

newDB.numdb = numdb
newDB.numdbs = numdb
newDB.stopAll = stopAll
newDB.onExitSignal = onExitSignal

module.exports = newDB
