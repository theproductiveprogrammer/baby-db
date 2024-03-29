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
const DBS = [];
function numdb() { return DBS.length; }
/*    understand/
 * stop all the DB's we are managing, invoking the callback
 * when they all have stopped
 */
function stopAll(cb) {
	let num_stopped = 0;
	DBS.map(db => db.stop(() => {
		num_stopped++;
		if(num_stopped == numdb()) {
			cb && cb();
		}
	}));
}
/*    understand/
 * handle common exit signals to ensure the best chance of persistence
 * invoking the callback once
 */
function onExitSignal(cb) {
	let callback_called = false;
	process.on('SIGINT', () => stopAll(cb_1));
	process.on('SIGTERM', () => stopAll(cb_1));
	process.on('SIGBREAK', () => stopAll(cb_1));

	function cb_1() {
		if(callback_called) return;
		callback_called = true;
		cb && cb();
	}
}



function newDB(file, opts) {
	const db = new BabyDB();

	let options = Object.assign({
		loadOnStart: true,

		saveEvery: 3000,
		maxRecsEvery: 3072,   /* 3072 records every 3 seconds */

		parseJSON: true,

	}, opts);

	if(!options.unmanaged) DBS.push(db);

	let linenum = 0;
	let saveBuffer = [];
	let savetimer;
	let saving = false;
	let stopped = false;
	let loaded = false;

	/*    way/
	 * stream in the file, line-by-line, and process each line as a record
	 */
	function load() {
		if(stopped) return;
		if(loaded) return;
		loaded = true;
		if(!file) return db.emit('done');

		let loaderror = false;
		const input = fs.createReadStream(file);
		input.on('error', err => {
			if(err.code === 'ENOENT') return db.emit('done');
			loaderror = true;
			db.emit('error', err);
		})
		input.on('end', () => {
			if(!loaderror) db.emit('done');
		});

		const rl = readline.createInterface({ input, crlfDelay: Infinity });
		rl.on('line', line => {
			linenum++;
			if(!line) return;
			line = line.trim();
			if(!line) return;

			let rec;
			if(options.parseJSON) {
				try {
					rec = JSON.parse(line);
				} catch(err) {
					db.emit('error', `Failed parsing ${file}:${linenum}:${line}`);
					return;
				}
			} else {
				rec = line;
			}

			try {
				db.emit('rec', rec, linenum);
			} catch(err) {
				db.emit('error', err);
			}

		});
	}

	/*    way/
	 * save the record then pass it on for processing
	 */
	function add(rec) {
		if(options.maxRecsEvery && saveBuffer.length > options.maxRecsEvery) {
			db.emit('overflow', rec);
			db.emit('error', 'overflow', rec);
			return;
		}

		try {
			save(rec);
		} catch(err) {
			db.emit('error', err);
			return;
		}

		try {
			linenum++;
			db.emit('rec', rec, linenum);
		} catch(err) {
			db.emit('error', err);
		}
	}


	/*    way/
	 * we perist the record periodically as a JSON encoded line
	 * NB: If JSON encoding fails we expect the add function to
	 * report the error to the user
	 */
	function save(rec) {
		if(options.parseJSON) rec = JSON.stringify(rec);
		const line = rec + '\n';
		const name = file || "stdout";
		if(stopped) throw `DB ${name} stopped. Cannot save ${line}`;
		saveBuffer.push(line);
		if(!savetimer) {
			savetimer = setTimeout(() => {
				persist(err => {
					if(err) db.emit('error', err);
					savetimer = 0;
				});
			}, options.saveEvery);
		}
	}

	/*    understand/
	 * we use this to save immediately. Useful for signal handler
	 * and when stopping/exiting
	 */
	function saveNow(cb) {
		if(saving) return;
		saving = true;
		let data = "";
		/* yes this is faster than Array.join() ! */
		for(let i = 0;i < saveBuffer.length;i++) data += saveBuffer[i];
		saveBuffer = [];
		try {
			if(!file) {
				if(file !== 0) fs.writeSync(process.stdout.fd, data);
			} else {
				fs.appendFileSync(file, data);
			}
			saving = false;
			cb && cb();
		} catch(err) {
			db.emit('error', err);
			cb && cb(err);
		}
	}

	/*    understand/
	 * we stop the db and save whatever we have right away
	 */
	function stop(cb) {
		if(stopped) {
			cb && cb();
			return
		}
		stopped = true;
		saveNow(() => {
			if(savetimer) clearTimeout(savetimer);
			savetimer = 0;
			db.emit('stopped');
			cb && cb();
		})
	}

	/*    way/
	 * persist the data to disk by creating a string of all the
	 * pending records in the buffer and appending them to the
	 * db file, rolling over to a new file if we are over the
	 * rolloverLimit
	 */
	function persist(cb) {
		if(!saveBuffer.length) return cb();

		saving = true;
		let sav_ = saveBuffer;
		saveBuffer = [];

		const onDone = err => {
			saving = false;
			if(err) {
				/* restore unsaved records on error */
				saveBuffer = sav_.concat(saveBuffer);
			}
			return cb(err);
		};

		/* yes this is faster than Array.join() ! */
		let data = "";
		for(let i = 0, len = sav_.length;i < len;i++) data += sav_[i];

		if(!file) { /* in-memory db */
			if(file === 0) return process.stdout.write(data, onDone); /* the stdout writer version - '0' */
			else return onDone();
		} else { /* disk db */

			fs.appendFile(file, data, err => {
				if(err) return onDone(err);

				if(should_rollover_1()) rollover(onDone);
				else onDone();

			});

		}

		function should_rollover_1() {
			return options.rolloverLimit && linenum >= options.rolloverLimit;
		}

	}

	/*    way/
	 * move existing records to an archive and start anew
	 */
	function rollover(cb) {
		const onDone = err => {
			if(err) return cb(`Rollover failed`);
			else {
				linenum = 0;
				db.emit('rollover');
				cb();
			}
		};

		if(!file) return onDone();

		const ts = (new Date()).toISOString().replace(/:/g,'_');
		const p = path.parse(file);
		const nfile = path.join(p.dir, `${p.name}-${ts}-${linenum}${p.ext}`);

		fs.rename(file, nfile, onDone);
	}

	/*    way/
	 * ensure the path to the database exists
	 */
	if(file && !fs.existsSync(file)) {
		const loc = path.dirname(file);
		if(!fs.existsSync(loc)) fs.mkdirSync(loc, { recursive: true });
		fs.closeSync(fs.openSync(file, 'a'));
	}

	/*    way/
	 * We add properties so we can write simpler class methods
	 */
	db.load = load;
	db.add = add;
	db.stop = stop;
	db.numdb = numdb;
	db.numdbs = numdb;
	db.onExitSignal = onExitSignal;

	/*    understand
	 * we auto load the data on construction
	 */
	if(options.loadOnStart) process.nextTick(() => load());

	return db;
}

newDB.numdb = numdb;
newDB.numdbs = numdb;
newDB.stopAll = stopAll;
newDB.onExitSignal = onExitSignal;

module.exports = newDB;

