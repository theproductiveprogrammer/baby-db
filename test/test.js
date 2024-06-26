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

			const db = babydb(0, { saveEvery: 5 })
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

			const db = babydb(0, { saveEvery: 5 })
			OBJS.map(o => db.add(o))

			setTimeout(() => {
				assert.equal(hook.captured(), OBJS_OUTPUT)
				hook.unhook()
				done()
			}, 25)

		})


		it('prints plain to stdout', function(done) {

			const hook = captureStream(process.stdout)

			const db = babydb(0, { parseJSON: false, saveEvery: 5 })
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

			const db = babydb(0, { parseJSON: false, saveEvery: 5 })
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


		it('reads from file', function(done) {
			const dbfile = path.join(__dirname, 'db1')
			const db = babydb(dbfile)
			OBJS.map(o => db.add(o))
			db.on('stopped', () => {
				const rdb = babydb(dbfile)
				const objs = []
				rdb.on('rec', rec => {
					objs.push(rec)
				})
				rdb.on('done', () => {
					rdb.on('stopped', () => {
						assert.deepEqual(objs, OBJS)
						fs.unlink(dbfile, () => done())
					})
					rdb.stop()
				})
			})
			db.stop()
		})

		it('updates file', function(done) {
			const dbfile = path.join(__dirname, 'db1')
			const db = babydb(dbfile, {
				saveEvery: 5
			})
			OBJS.map(o => db.add(o))

			setTimeout(() => {
				const rdb = babydb(dbfile, {
					saveEvery: 5
				})
				const objs = []
				rdb.on('rec', rec => {
					objs.push(rec)
				})
				rdb.on('done', () => {
					OBJS.map(o => rdb.add(o))
					setTimeout(() => {
						const expected = OBJS.concat(OBJS)
						assert.deepEqual(objs, expected)
						fs.unlink(dbfile, () => done())
					}, 15)

				})
			}, 15)

		})

	}) /* output to file */

	describe('overflow handling', function () {

		it('does not write overflow records', function(done) {
			const dbfile = path.join(__dirname, 'db1')
			const db = babydb(dbfile, {
				saveEvery: 5,
				maxRecsEvery: 100,
			})
			let numrecs = 0
			let overflowed = 0
			db.on('rec', rec => numrecs++)
			db.on('overflow', rec => overflowed++)
			db.on('error', (err, rec) => assert.equal(err, 'overflow'))

			let totalrecs = 0
			for(let i = 0;i < 100;i++) {
				OBJS.map(o => db.add(o))
				totalrecs += OBJS.length
			}

			assert.equal(numrecs < 110, true)
			assert.equal(overflowed, totalrecs - numrecs)

			db.on('stopped', () => {
				const rdb = babydb(dbfile)
				let numread = 0
				rdb.on('rec', rec => numread++)
				rdb.on('done', () => {
					assert.equal(numread, numrecs)
					fs.unlink(dbfile, () => done())
				})
			})
			db.stop()
		})

	}) /* overflow handling */


	describe('rollover', function () {

		it('rolls over when too many records', function(done) {
			const dbfile = path.join(__dirname, 'db1')
			const db = babydb(dbfile, {
				saveEvery: 5,
				rolloverLimit: 5,
			})
			const rolledover = { type: 'rolled over' }
			db.on('rollover', () => {
				db.add(rolledover)
			})

			for(let i = 0;i < 10;i++) db.add({ testing: 123 })
			setTimeout(() => {
				for(let i = 0;i < 3;i++) db.add({ testing: 123 })
			}, 15)

			setTimeout(() => {
				const rdb = babydb(dbfile)
				let first = true
				rdb.on('rec', rec => {
					if(first) assert.deepEqual(rec, rolledover)
					first = false
				})
				rdb.on('stopped', () => {
					const dbfolder = path.dirname(dbfile)
					fs.readdir(dbfolder, (err, files) => {
						assert.equal(err, null)
						un_link_1(0)

						function un_link_1(ndx) {
							if(ndx >= files.length) return done()
							const curr = files[ndx]
							if(!curr.startsWith('db1')) return un_link_1(ndx+1)
							else fs.unlink(path.join(dbfolder,curr), () => un_link_1(ndx+1))
						}
					})
				})
				babydb.stopAll()
			}, 25)
		})

	})


})
