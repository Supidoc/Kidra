/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1576884274")

  // add field
  collection.fields.addAt(3, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_1282675120",
    "help": "",
    "hidden": false,
    "id": "relation2709559484",
    "maxSelect": 0,
    "minSelect": 0,
    "name": "library",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1576884274")

  // remove field
  collection.fields.removeById("relation2709559484")

  return app.save(collection)
})
