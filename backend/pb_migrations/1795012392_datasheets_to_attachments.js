/// <reference path="../pb_data/types.d.ts" />

// Turns the PDF-only `datasheets` collection into a generic `attachments` library:
// - renames the collection (the id and the stored files stay, so `parts.datasheet` keeps
//   working and now means "primary datasheet"),
// - adds `kind` (existing rows become `datasheet`) and an optional `description`,
// - accepts any file type up to 100 MB,
// - drops the unique name index (different parts may have files with the same name),
// - adds `parts.attachments` (many attachments per part), filled from `parts.datasheet`.
//
// No view collection or API rule references `datasheets` by name (checked when written).

const ATTACHMENTS_ID = "pbc_1874485341";
const PARTS_ID = "pbc_2718308629";

migrate((app) => {
  const attachments = app.findCollectionByNameOrId(ATTACHMENTS_ID);

  attachments.name = "attachments";
  attachments.indexes = [
    "CREATE INDEX `idx_attachments_name` ON `attachments` (`name`)",
  ];

  attachments.fields.add(new Field({
    "hidden": false,
    "id": "select2363381545",
    "maxSelect": 1,
    "name": "kind",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": ["datasheet", "reference-manual", "app-note", "3d-model", "image", "other"],
  }));

  attachments.fields.add(new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1843675174",
    "max": 0,
    "min": 0,
    "name": "description",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text",
  }));

  const file = attachments.fields.getByName("file");
  file.mimeTypes = [];
  file.maxSize = 104857600;

  app.save(attachments);

  app.db().newQuery("UPDATE `attachments` SET `kind` = 'datasheet'").execute();

  const parts = app.findCollectionByNameOrId(PARTS_ID);
  parts.fields.add(new Field({
    "cascadeDelete": false,
    "collectionId": ATTACHMENTS_ID,
    "hidden": false,
    "id": "relation2512432127",
    "maxSelect": 999,
    "minSelect": 0,
    "name": "attachments",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation",
  }));
  app.save(parts);

  // Raw SQL so the parts keep their `updated` timestamps.
  app.db()
    .newQuery(
      "UPDATE `parts` SET `attachments` = json_array(`datasheet`) " +
        "WHERE `datasheet` IS NOT NULL AND `datasheet` != ''",
    )
    .execute();
}, (app) => {
  const parts = app.findCollectionByNameOrId(PARTS_ID);
  parts.fields.removeByName("attachments");
  app.save(parts);

  const attachments = app.findCollectionByNameOrId(ATTACHMENTS_ID);
  attachments.fields.removeByName("kind");
  attachments.fields.removeByName("description");

  const file = attachments.fields.getByName("file");
  file.mimeTypes = ["application/pdf"];
  file.maxSize = 0;

  attachments.name = "datasheets";
  attachments.indexes = [
    "CREATE UNIQUE INDEX `idx_cymkvsfpan` ON `datasheets` (`name`)",
  ];

  app.save(attachments);
});
