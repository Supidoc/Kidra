/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2103600739")

  // update collection data
  unmarshal({
    "listRule": "@request.auth.roles = \"admin\"",
    "viewRule": "@request.auth.roles = \"admin\""
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2103600739")

  // update collection data
  unmarshal({
    "listRule": "@request.auth.roles = \"System Admin\"",
    "viewRule": "@request.auth.roles = \"System Admin\""
  }, collection)

  return app.save(collection)
})
