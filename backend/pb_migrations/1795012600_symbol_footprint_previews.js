/// <reference path="../pb_data/types.d.ts" />
// Adds rendered SVG previews, source hashes and integrity counters to the
// symbols/footprints collections. The Go library parsers fill these fields.
migrate((app) => {
  const previewField = (id) => new Field({
    "id": id,
    "name": "preview",
    "type": "file",
    "hidden": false,
    "presentable": false,
    "required": false,
    "system": false,
    "maxSelect": 1,
    "maxSize": 5242880,
    "mimeTypes": ["image/svg+xml"],
    "thumbs": [],
    "protected": false
  })
  const textField = (id, name) => new Field({
    "id": id,
    "name": name,
    "type": "text",
    "autogeneratePattern": "",
    "hidden": false,
    "max": 0,
    "min": 0,
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false
  })
  const numberField = (id, name) => new Field({
    "id": id,
    "name": name,
    "type": "number",
    "hidden": false,
    "max": null,
    "min": 0,
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false
  })

  const symbols = app.findCollectionByNameOrId("symbols")
  symbols.fields.add(previewField("file1795012601"))
  symbols.fields.add(textField("text1795012602", "sourceHash"))
  symbols.fields.add(numberField("number1795012603", "pinCount"))
  app.save(symbols)

  const footprints = app.findCollectionByNameOrId("footprints")
  footprints.fields.add(previewField("file1795012611"))
  footprints.fields.add(textField("text1795012612", "sourceHash"))
  footprints.fields.add(numberField("number1795012613", "padCount"))
  footprints.fields.add(textField("text1795012614", "model3d"))
  return app.save(footprints)
}, (app) => {
  const symbols = app.findCollectionByNameOrId("symbols")
  symbols.fields.removeById("file1795012601")
  symbols.fields.removeById("text1795012602")
  symbols.fields.removeById("number1795012603")
  app.save(symbols)

  const footprints = app.findCollectionByNameOrId("footprints")
  footprints.fields.removeById("file1795012611")
  footprints.fields.removeById("text1795012612")
  footprints.fields.removeById("number1795012613")
  footprints.fields.removeById("text1795012614")
  return app.save(footprints)
})
