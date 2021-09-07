'use strict'
const assert = require('assert')

const babydb = require('..')

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
      const objs = [
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
      objs.map(o => db.add(o))

      setTimeout(() => {
        assert.equal(hook.captured(), objs.map(o => JSON.stringify(o)).join('\n') + "\n")
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
      const out = [
        "Testing 123",
        "Hello hello, anyone out there?",
        "What a wondeful world!",
      ]
      out.map(o => db.add(o))

      setTimeout(() => {
        assert.equal(hook.captured(), out.join('\n') + "\n")
        hook.unhook()
        done()
      }, 25)

    })


  }) /* output to console */
  })

})
