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
    //prev.apply(stream, arguments)
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

      const db1 = babydb(null, { saveEvery: 5 })
      const obj = { testing: 123 }
      db1.add(obj)

      setTimeout(() => {
        assert.equal(hook.captured(), JSON.stringify(obj) + "\n")
        hook.unhook()
        done()
      }, 25)
    })


  })

})
