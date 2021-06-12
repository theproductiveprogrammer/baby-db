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
const badb = require('baby-db')

...
const userdb = badb(userfile)
userdb.on("rec", (rec, num) => {
  if(rec.type === "new") USERS[rec.userid] = rec.info
  else if(rec.type === "del") delete USERS[rec.userid]
  else throw `Did not understand record: ${num}`
})
userdb.on("error", err => console.error(err))
userdb.on("done", () => console.log("ready to rumble!..."))
...
userdb.add({ type: "new", userid: id++, info: {name: ...}})
```

## Clean Exits

**Baby DB** is designed to support persisting it’s data and cleanly exiting. You can do this by calling `db.stop()` or (recommended), by installing the `onExitSignal()` handler which will trap all common exit signals and flush the data to disk.

```javascript
userdb.onExitSignal(() => {
  process.exit() // use process.exit() otherwise the application will not exit
})
```



Enjoy!

------

