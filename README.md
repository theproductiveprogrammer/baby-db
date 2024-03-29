# Baby DB

A easy-to-use, robust, file-based DB for Node. Acts as an append-only store for objects.

![icon](./baby-db.png)

## Motivation

When writing NodeJs projects I often find I need an easy-to-use, understandable, yet robust database that I can throw into my project without needing to install another database server and configure a connection etc.

What I needed was a dead simple library that I could plug into any project and that would:

1. Keep data persisted safely
2. Be easy to examine & understand
3. Be easy to backup
4. Be able to scale up reasonably well for small to mid-sized projects.

And so **Baby DB** was born.

## How to Use Baby DB

**Baby DB** stores data in an [append only](https://en.wikipedia.org/wiki/Append-only) log file. This makes it almost impossible to lose data (except if the underlying hardware fails). It’s also a very flexible way to store data - it’s easy to add fields, change the schema and so on by upgrading the processor.

Each instance requires us to pass in a “processor” that consumes each record and aggregates or stores it for use by the rest of the system.  **Baby DB** itself streams the data records so it has very low memory overhead.

To keep things simple, while you could have all data stored in a single log file, it may be better to store each “table” of data in it’s own file.

### Example

```javascript
const babydb = require('baby-db');

...
const db1 = babydb(file1);
db1.on('error', err => console.error(err));
db1.on('rec', (rec, linenum) => {
  switch(rec.type) {
    case 'new':
      DATA1[rec.userid] = rec.info;
      break;
    case 'update':
      if(!DATA1[rec.userid]) throw `Cannot update non-existent record on line: ${linenum}`;
      Object.assign(DATA1[rec.userid], rec.info);
      break;
    case 'delete':
      delete DATA1[rec.userid];
      break;
    default:
      throw `Did not understand record type: "${rec.type}", on line: ${linenum}`.
  }
})
db1.on('done', () => {
  console.log("ready to rumble....!")
});
  
...
function annoyed_jack() {
  const jack = 2;
  db1.add({ type: 'new', userid: jack, info: { name: 'jack', mood: 'annoyed'}})
  db1.add({ type: 'update', userid: jack, info: { mood: 'really annoyed'}})
  db1.add({ type: 'delete', userid: jack})
}

function sleepy_jill() {
  const jill = 3;
  db1.add({ type: 'new', userid: jill, info: { name: 'jill', mood: 'sleepy'}})
  db1.add({ type: 'update', userid: jill, info: { mood: 'hungry'}})

}
...

db1.onExitSignal(() => process.exit())

```

## Clean Exits

**Baby DB** is designed to support persisting it’s data and cleanly exiting. You can do this by calling `db.stop()` or (recommended), by installing the `onExitSignal()` handler which will trap all common exit signals and flush the data to disk.

```javascript
babydb.onExitSignal(() => {
  process.exit() // use process.exit() otherwise the application will not exit
})
```

## Options

**Baby DB** supports the following options (defaults shown):

```javascript
const db1 = babydb(file, {
  loadOnStart: true, // otherwise call load()
  saveEvery: 3000,   // persist to disk every 3 seconds
  maxRecsEvery: 3072, // any additional spike of records beyond 3072 every 3 seconds will raise an 'overflow' event
  unmanaged: false,   // stopAll() and onExitSignal() will ignore this database if true
  rolloverLimit: 0    // causes the file to roll over when the number of records goes over (see below)
})
```

## Rollover

When using an append-only log, it's common to find that it grows very large very quickly.

**Baby DB** handles this problem by allowing you to specify a `rolloverLimit` in your options. Once the number of records in a file goes beyond this number, it is archived in the format:

```
  filename-<timestamp>-<number of records>.ext
```

**NB**: The number of records in the file could be above the actual `rolloverLimit` depending on how many additional records came in during the write period.

### Snapshot record(s)

When we set a rollover, the old records are no longer processed and so, if they need to be, it is helpful to add some 'summary' records at the start of the new roll(-ed)-over file that captures what we need from the old records. To do this, listen for the 'rollover' event and use that to add the summary records. For example:

```javascript
db1.on('rollover', create_summary_records);

function create_summary_records() {
    // Remember you may need to make a copy of your
    // existing data structure because adding
    // new records will usually cause the data
    // structures to be updated
    db1.add({ type: 'summary', info: { ... }, meta: { ... }}))
}
```

### Manual Rollover

There are times we would like to "clean" the database without waiting for the rollover limit to be reached. In such a case we can call the `db.rollover()` function directly. This will cause the data to flush to disk and then the rollover to be performed.

```javascript
db1.rollover(() => console.log("rollover done!");
```

## Overflow

**Baby DB** provides an option for ignoring data ‘spikes’ that may come up either accidentally or due to some malicious intent. 

To handle overflow records, listen for the ‘overflow’ event:

```javascript
userdb.on('overflow', rec => {
  // alert the navy
  save_somewhere_else(rec)
})
```

By default more than 1024 records every second is considered an ‘overflow’. This is easily changed using the options described in the Options section. In particular, setting the `maxRecsEvery` parameter to `0` will have **BabyDB** never mark any records as ‘overflow’.

Enjoy!

------

