/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2103600739")

  // update collection data
  unmarshal({
    "viewRule": "@request.auth.roles ?= 'System Admin'"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2103600739")

  // update collection data
  unmarshal({
    "viewRule": "@request.auth.roles ?= 'Admin'"
  }, collection)

  return app.save(collection)
})
