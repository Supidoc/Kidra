/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2103600739")

  // update collection data
  unmarshal({
    "listRule": "@request.auth.role = \"System Admin\"",
    "viewRule": "@request.auth.role = \"System Admin\""
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2103600739")

  // update collection data
  unmarshal({
    "listRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.roles ?= \"System Admin\""
  }, collection)

  return app.save(collection)
})
