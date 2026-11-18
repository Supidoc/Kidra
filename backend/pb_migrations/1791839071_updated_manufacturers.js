/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2103600739")

  // update collection data
  unmarshal({
    "createRule": "@request.auth.roles:each ?= \"admin\"",
    "deleteRule": "@request.auth.roles:each ?= \"admin\"",
    "updateRule": "@request.auth.roles:each ?= \"admin\""
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2103600739")

  // update collection data
  unmarshal({
    "createRule": null,
    "deleteRule": null,
    "updateRule": null
  }, collection)

  return app.save(collection)
})
