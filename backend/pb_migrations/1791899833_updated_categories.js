/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3292755704")

  // update collection data
  unmarshal({
    "createRule": "@request.auth.roles:each ?= \"admin\"",
    "deleteRule": "@request.auth.roles:each ?= \"admin\"",
    "listRule": "@request.auth.roles:each ?= \"admin\"",
    "updateRule": "@request.auth.roles:each ?= \"admin\"",
    "viewRule": "@request.auth.roles:each ?= \"admin\""
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3292755704")

  // update collection data
  unmarshal({
    "createRule": null,
    "deleteRule": null,
    "listRule": null,
    "updateRule": null,
    "viewRule": null
  }, collection)

  return app.save(collection)
})
