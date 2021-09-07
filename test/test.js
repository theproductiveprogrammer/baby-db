'use strict'
const path = require('path')
const fs = require('fs')
const assert = require('assert')

const babydb = require('..')

/*    understand/
 * testing objects
 */
const OBJS = [
  { testing: 123 },
  { testing: 123, without: "you here with me" },
  { we: "have",
    a: {
      deeper: {
        connection: {
          to: "food"
        }
      },
      than: {
        to: "entertainment"
      }
    },
    more: "stuff",
  },
]
const OBJS_OUTPUT = OBJS.map(o => JSON.stringify(o)).join('\n') + "\n"
const OUTS = [
  "Testing 123",
  "Hello hello, anyone out there?",
  "What a wondeful world!",
]


/*    problem/
 * we want to test a write to the console
 *    way/
 * we hook into the process.stdout.write function
 * and capture the output
 */
function captureStream(stream) {
  const prev = stream.write
  let buf = ""
  stream.write = function(chunk, encoding, callback) {
    buf += chunk.toString()
    //prev.apply(stream, arguments) /* uncomment to see errors */
  }

  return {
    unhook: () => stream.write = prev,
    captured: () => buf,
  }
}

describe('baby-db', function() {

  describe('output to console', function() {

    it('prints to stdout', function(done) {

      const hook = captureStream(process.stdout)

      const db = babydb(null, { saveEvery: 5 })
      const obj = { testing: 123 }
      db.add(obj)

      setTimeout(() => {
        assert.equal(hook.captured(), JSON.stringify(obj) + "\n")
        hook.unhook()
        done()
      }, 25)
    })

    it('prints multiple lines to stdout', function(done) {

      const hook = captureStream(process.stdout)

      const db = babydb(null, { saveEvery: 5 })
      OBJS.map(o => db.add(o))

      setTimeout(() => {
        assert.equal(hook.captured(), OBJS_OUTPUT)
        hook.unhook()
        done()
      }, 25)

    })


    it('prints plain to stdout', function(done) {

      const hook = captureStream(process.stdout)

      const db = babydb(null, { parseJSON: false, saveEvery: 5 })
      const out = "Testing 123"
      db.add(out)

      setTimeout(() => {
        assert.equal(hook.captured(), out + "\n")
        hook.unhook()
        done()
      }, 25)

    })

    it('prints multiple lines plain to stdout', function(done) {

      const hook = captureStream(process.stdout)

      const db = babydb(null, { parseJSON: false, saveEvery: 5 })
      OUTS.map(o => db.add(o))

      setTimeout(() => {
        assert.equal(hook.captured(), OUTS.join('\n') + "\n")
        hook.unhook()
        done()
      }, 25)

    })


  }) /* output to console */


  describe('output to file', function () {

    it('creates file', function(done) {
      const dbfile = path.join(__dirname, 'db1')
      const db = babydb(dbfile, {
        saveEvery: 5
      })
      db.add({ testing: 123 })
      setTimeout(() => {
        assert.equal(fs.existsSync(dbfile), true)
        db.stop()
        fs.unlink(dbfile, () => done())
      }, 25)
    })

    it('writes to file', function(done) {
      const dbfile = path.join(__dirname, 'db1')
      const db = babydb(dbfile, {
        saveEvery: 5
      })
      OBJS.map(o => db.add(o))
      setTimeout(() => {
        db.stop()
        const data = fs.readFileSync(dbfile)
        assert.equal(data, OBJS_OUTPUT)
        fs.unlink(dbfile, () => done())
      }, 25)
    })


  })

})
