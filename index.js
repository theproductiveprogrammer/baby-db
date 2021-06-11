'use strict'
const EventEmitter = require('events')
const fs = require('fs')
const readline = require('readline')

class NodeDB extends EventEmitter {}


module.exports = file => {
  const nodedb = new NodeDB()

  /*    way/
   * stream in the file, line-by-line, and process each line as a record
   */
  function load() {
    const input = fs.createReadStream(file)
    input.on('error', err => {
      if(err.code === 'ENOENT') nodedb.emit('done')
      else nodedb.emit('error', err)
    })
    input.on('end', () => nodedb.emit('done'))

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
        nodedb.emit('error', `Failed parsing ${file}:${num}:${line}`)
      }
      if(!rec) return

      try {
        nodedb.emit('rec', rec, num)
      } catch(err) {
        nodedb.emit('error', err)
      }

    })
  }

  load()

  return nodedb
}
