/// <reference path="../pb_data/types.d.ts" />

// Schema catch-up (S3 spike of the deployment plan).
//
// Several schema edits were made in the dashboard without a migration being written, so
// the earlier migrations alone did not reproduce the real schema: on an empty data dir
// 1795012392_datasheets_to_attachments.js failed because `datasheets` did not exist.
//
// This imports the missing/changed collections exactly as they were in the reference
// database right before 1795012392: the collections that were never migrated (unitSets,
// ratings, distributors, distributorParts, datasheets, tags, tagsPartsCountView) and the
// API rules, `required` flags and fields added later to parts, units, footprints,
// footprintLibraries, symbolLibraries and symbols.
//
// It only acts on databases built from migrations: when the datasheets/attachments
// collection (pbc_1874485341) already exists, the schema is already complete (existing
// installs) and nothing is changed.

const CATCHUP_MARKER_ID = "pbc_1874485341";

migrate((app) => {
  try {
    app.findCollectionByNameOrId(CATCHUP_MARKER_ID);
    return; // existing install: schema already complete
  } catch (_) {
    // database built from migrations: import the snapshot below
  }

  const snapshot = [
    {
      "id": "pbc_2718308629",
      "name": "parts",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.roles:each ?= \"admin\"",
      "viewRule": "@request.auth.roles:each ?= \"admin\"",
      "createRule": "@request.auth.roles:each ?= \"admin\"",
      "updateRule": "@request.auth.roles:each ?= \"admin\"",
      "deleteRule": "@request.auth.roles:each ?= \"admin\"",
      "indexes": [],
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
          "help": "",
          "hidden": false,
          "id": "text3208210256",
          "max": 15,
          "min": 15,
          "name": "id",
          "pattern": "^[a-z0-9]+$",
          "presentable": false,
          "primaryKey": true,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "help": "",
          "hidden": false,
          "id": "text3181372199",
          "max": 0,
          "min": 0,
          "name": "valueRaw",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "help": "",
          "hidden": false,
          "id": "number985395922",
          "max": null,
          "min": null,
          "name": "valueSi",
          "onlyInt": false,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "help": "",
          "hidden": false,
          "id": "bool560385931",
          "name": "isNumeric",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "cascadeDelete": false,
          "collectionId": "pbc_586599074",
          "help": "",
          "hidden": false,
          "id": "relation3703245907",
          "maxSelect": 0,
          "minSelect": 0,
          "name": "unit",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "relation"
        },
        {
          "autogeneratePattern": "",
          "help": "",
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
          "type": "text"
        },
        {
          "cascadeDelete": false,
          "collectionId": "pbc_3780197902",
          "help": "",
          "hidden": false,
          "id": "relation2927384206",
          "maxSelect": 0,
          "minSelect": 0,
          "name": "designator",
          "presentable": false,
          "required": true,
          "system": false,
          "type": "relation"
        },
        {
          "cascadeDelete": false,
          "collectionId": "pbc_1576884274",
          "help": "",
          "hidden": false,
          "id": "relation4261586487",
          "maxSelect": 0,
          "minSelect": 0,
          "name": "footprint",
          "presentable": false,
          "required": true,
          "system": false,
          "type": "relation"
        },
        {
          "cascadeDelete": false,
          "collectionId": "pbc_1322267247",
          "help": "",
          "hidden": false,
          "id": "relation3972544249",
          "maxSelect": 0,
          "minSelect": 0,
          "name": "symbol",
          "presentable": false,
          "required": true,
          "system": false,
          "type": "relation"
        },
        {
          "cascadeDelete": false,
          "collectionId": "pbc_2103600739",
          "help": "",
          "hidden": false,
          "id": "relation1024124636",
          "maxSelect": 0,
          "minSelect": 0,
          "name": "manufacturer",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "relation"
        },
        {
          "autogeneratePattern": "",
          "help": "",
          "hidden": false,
          "id": "text274359022",
          "max": 0,
          "min": 0,
          "name": "manufacturerNumber",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "cascadeDelete": false,
          "collectionId": "pbc_3292755704",
          "help": "",
          "hidden": false,
          "id": "relation105650625",
          "maxSelect": 0,
          "minSelect": 0,
          "name": "category",
          "presentable": false,
          "required": true,
          "system": false,
          "type": "relation"
        },
        {
          "help": "",
          "hidden": false,
          "id": "bool3161794404",
          "name": "excludeFromBoard",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "help": "",
          "hidden": false,
          "id": "bool2763238702",
          "name": "excludeFromBom",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "help": "",
          "hidden": false,
          "id": "select2063623452",
          "maxSelect": 0,
          "name": "status",
          "presentable": false,
          "required": true,
          "system": false,
          "type": "select",
          "values": [
            "Active",
            "Not for New Design",
            "Deprecate"
          ]
        },
        {
          "help": "",
          "hidden": false,
          "id": "number3206337475",
          "max": null,
          "min": 0,
          "name": "version",
          "onlyInt": true,
          "presentable": false,
          "required": true,
          "system": false,
          "type": "number"
        },
        {
          "cascadeDelete": true,
          "collectionId": "pbc_4019870572",
          "help": "",
          "hidden": false,
          "id": "relation3468036041",
          "maxSelect": 20,
          "minSelect": 0,
          "name": "ratings",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "relation"
        },
        {
          "cascadeDelete": true,
          "collectionId": "pbc_3293781247",
          "help": "",
          "hidden": false,
          "id": "relation682085663",
          "maxSelect": 10,
          "minSelect": 0,
          "name": "distributorParts",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "relation"
        },
        {
          "cascadeDelete": false,
          "collectionId": "pbc_1874485341",
          "help": "",
          "hidden": false,
          "id": "relation1633036827",
          "maxSelect": 0,
          "minSelect": 0,
          "name": "datasheet",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "relation"
        },
        {
          "cascadeDelete": false,
          "collectionId": "pbc_1219621782",
          "help": "",
          "hidden": false,
          "id": "relation1874629670",
          "maxSelect": 20,
          "minSelect": 0,
          "name": "tags",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "relation"
        },
        {
          "hidden": false,
          "id": "autodate2990389176",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": false,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "autodate3332085495",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": false,
          "type": "autodate"
        }
      ]
    },
    {
      "id": "pbc_586599074",
      "name": "units",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.roles:each ?= \"admin\"",
      "viewRule": "@request.auth.roles:each ?= \"admin\"",
      "createRule": "@request.auth.roles:each ?= \"admin\"",
      "updateRule": "@request.auth.roles:each ?= \"admin\"",
      "deleteRule": "@request.auth.roles:each ?= \"admin\"",
      "indexes": [],
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
          "help": "",
          "hidden": false,
          "id": "text3208210256",
          "max": 15,
          "min": 15,
          "name": "id",
          "pattern": "^[a-z0-9]+$",
          "presentable": false,
          "primaryKey": true,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "help": "",
          "hidden": false,
          "id": "text1579384326",
          "max": 0,
          "min": 0,
          "name": "name",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "help": "",
          "hidden": false,
          "id": "text1247294221",
          "max": 0,
          "min": 0,
          "name": "symbolFancy",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "help": "",
          "hidden": false,
          "id": "text2253586918",
          "max": 0,
          "min": 0,
          "name": "symbolLetter",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "cascadeDelete": false,
          "collectionId": "pbc_738656850",
          "help": "",
          "hidden": false,
          "id": "relation1084610049",
          "maxSelect": 0,
          "minSelect": 0,
          "name": "unitSet",
          "presentable": false,
          "required": true,
          "system": false,
          "type": "relation"
        },
        {
          "help": "",
          "hidden": false,
          "id": "number3979930624",
          "max": null,
          "min": null,
          "name": "factor",
          "onlyInt": false,
          "presentable": false,
          "required": true,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "autodate2990389176",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": false,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "autodate3332085495",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": false,
          "type": "autodate"
        }
      ]
    },
    {
      "id": "pbc_1576884274",
      "name": "footprints",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.roles:each ?= \"admin\"",
      "viewRule": "@request.auth.roles:each ?= \"admin\"",
      "createRule": null,
      "updateRule": null,
      "deleteRule": null,
      "indexes": [],
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
          "help": "",
          "hidden": false,
          "id": "text3208210256",
          "max": 15,
          "min": 15,
          "name": "id",
          "pattern": "^[a-z0-9]+$",
          "presentable": false,
          "primaryKey": true,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "help": "",
          "hidden": false,
          "id": "text1579384326",
          "max": 0,
          "min": 0,
          "name": "name",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "help": "",
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
          "type": "text"
        },
        {
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
        },
        {
          "help": "",
          "hidden": false,
          "id": "bool2777654405",
          "name": "available",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "hidden": false,
          "id": "autodate2990389176",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": false,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "autodate3332085495",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": false,
          "type": "autodate"
        }
      ]
    },
    {
      "id": "pbc_1282675120",
      "name": "footprintLibraries",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.roles:each ?= \"admin\"",
      "viewRule": "@request.auth.roles:each ?= \"admin\"",
      "createRule": null,
      "updateRule": null,
      "deleteRule": null,
      "indexes": [],
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
          "help": "",
          "hidden": false,
          "id": "text3208210256",
          "max": 15,
          "min": 15,
          "name": "id",
          "pattern": "^[a-z0-9]+$",
          "presentable": false,
          "primaryKey": true,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "help": "",
          "hidden": false,
          "id": "bool2777654405",
          "name": "available",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "autogeneratePattern": "",
          "help": "",
          "hidden": false,
          "id": "text1579384326",
          "max": 0,
          "min": 0,
          "name": "name",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "autodate2990389176",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": false,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "autodate3332085495",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": false,
          "type": "autodate"
        }
      ]
    },
    {
      "id": "pbc_836968374",
      "name": "symbolLibraries",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.roles:each ?= \"admin\"",
      "viewRule": "@request.auth.roles:each ?= \"admin\"",
      "createRule": null,
      "updateRule": null,
      "deleteRule": null,
      "indexes": [],
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
          "help": "",
          "hidden": false,
          "id": "text3208210256",
          "max": 15,
          "min": 15,
          "name": "id",
          "pattern": "^[a-z0-9]+$",
          "presentable": false,
          "primaryKey": true,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "help": "",
          "hidden": false,
          "id": "text1579384326",
          "max": 0,
          "min": 0,
          "name": "name",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "help": "",
          "hidden": false,
          "id": "bool2777654405",
          "name": "available",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "autogeneratePattern": "",
          "help": "",
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
          "type": "text"
        },
        {
          "hidden": false,
          "id": "autodate2990389176",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": false,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "autodate3332085495",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": false,
          "type": "autodate"
        }
      ]
    },
    {
      "id": "pbc_1322267247",
      "name": "symbols",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.roles:each ?= \"admin\"",
      "viewRule": "@request.auth.roles:each ?= \"admin\"",
      "createRule": null,
      "updateRule": null,
      "deleteRule": null,
      "indexes": [],
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
          "help": "",
          "hidden": false,
          "id": "text3208210256",
          "max": 15,
          "min": 15,
          "name": "id",
          "pattern": "^[a-z0-9]+$",
          "presentable": false,
          "primaryKey": true,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "help": "",
          "hidden": false,
          "id": "text1579384326",
          "max": 0,
          "min": 0,
          "name": "name",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "help": "",
          "hidden": false,
          "id": "bool2777654405",
          "name": "available",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "cascadeDelete": false,
          "collectionId": "pbc_836968374",
          "help": "",
          "hidden": false,
          "id": "relation2709559484",
          "maxSelect": 0,
          "minSelect": 0,
          "name": "library",
          "presentable": false,
          "required": true,
          "system": false,
          "type": "relation"
        },
        {
          "autogeneratePattern": "",
          "help": "",
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
          "type": "text"
        },
        {
          "hidden": false,
          "id": "autodate2990389176",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": false,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "autodate3332085495",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": false,
          "type": "autodate"
        }
      ]
    },
    {
      "id": "pbc_738656850",
      "name": "unitSets",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.roles:each ?= \"admin\"",
      "viewRule": "@request.auth.roles:each ?= \"admin\"",
      "createRule": "@request.auth.roles:each ?= \"admin\"",
      "updateRule": "@request.auth.roles:each ?= \"admin\"",
      "deleteRule": "@request.auth.roles:each ?= \"admin\"",
      "indexes": [],
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
          "help": "",
          "hidden": false,
          "id": "text3208210256",
          "max": 15,
          "min": 15,
          "name": "id",
          "pattern": "^[a-z0-9]+$",
          "presentable": false,
          "primaryKey": true,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "help": "",
          "hidden": false,
          "id": "text1579384326",
          "max": 0,
          "min": 0,
          "name": "name",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "autodate2990389176",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": false,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "autodate3332085495",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": false,
          "type": "autodate"
        }
      ]
    },
    {
      "id": "pbc_4019870572",
      "name": "ratings",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.roles:each ?= \"admin\"",
      "viewRule": "@request.auth.roles:each ?= \"admin\"",
      "createRule": "@request.auth.roles:each ?= \"admin\"",
      "updateRule": "@request.auth.roles:each ?= \"admin\"",
      "deleteRule": "@request.auth.roles:each ?= \"admin\"",
      "indexes": [],
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
          "help": "",
          "hidden": false,
          "id": "text3208210256",
          "max": 15,
          "min": 15,
          "name": "id",
          "pattern": "^[a-z0-9]+$",
          "presentable": false,
          "primaryKey": true,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "help": "",
          "hidden": false,
          "id": "text2324736937",
          "max": 0,
          "min": 2,
          "name": "key",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "help": "",
          "hidden": false,
          "id": "text494360628",
          "max": 0,
          "min": 1,
          "name": "value",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "autodate2990389176",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": false,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "autodate3332085495",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": false,
          "type": "autodate"
        }
      ]
    },
    {
      "id": "pbc_1395946501",
      "name": "distributors",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.roles:each ?= \"admin\"",
      "viewRule": "@request.auth.roles:each ?= \"admin\"",
      "createRule": "@request.auth.roles:each ?= \"admin\"",
      "updateRule": "@request.auth.roles:each ?= \"admin\"",
      "deleteRule": "@request.auth.roles:each ?= \"admin\"",
      "indexes": [
        "CREATE UNIQUE INDEX `idx_u3us1o4r18` ON `distributors` (`name`)"
      ],
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
          "help": "",
          "hidden": false,
          "id": "text3208210256",
          "max": 15,
          "min": 15,
          "name": "id",
          "pattern": "^[a-z0-9]+$",
          "presentable": false,
          "primaryKey": true,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "help": "",
          "hidden": false,
          "id": "text1579384326",
          "max": 0,
          "min": 0,
          "name": "name",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "exceptDomains": [],
          "help": "",
          "hidden": false,
          "id": "url1198480871",
          "name": "website",
          "onlyDomains": [],
          "presentable": false,
          "required": false,
          "system": false,
          "type": "url"
        },
        {
          "autogeneratePattern": "",
          "help": "",
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
          "type": "text"
        },
        {
          "hidden": false,
          "id": "autodate2990389176",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": false,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "autodate3332085495",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": false,
          "type": "autodate"
        }
      ]
    },
    {
      "id": "pbc_3293781247",
      "name": "distributorParts",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.roles:each ?= \"admin\"",
      "viewRule": "@request.auth.roles:each ?= \"admin\"",
      "createRule": "@request.auth.roles:each ?= \"admin\"",
      "updateRule": "@request.auth.roles:each ?= \"admin\"",
      "deleteRule": "@request.auth.roles:each ?= \"admin\"",
      "indexes": [],
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
          "help": "",
          "hidden": false,
          "id": "text3208210256",
          "max": 15,
          "min": 15,
          "name": "id",
          "pattern": "^[a-z0-9]+$",
          "presentable": false,
          "primaryKey": true,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "cascadeDelete": false,
          "collectionId": "pbc_1395946501",
          "help": "",
          "hidden": false,
          "id": "relation2747619185",
          "maxSelect": 0,
          "minSelect": 0,
          "name": "distributor",
          "presentable": false,
          "required": true,
          "system": false,
          "type": "relation"
        },
        {
          "autogeneratePattern": "",
          "help": "",
          "hidden": false,
          "id": "text1104947920",
          "max": 0,
          "min": 0,
          "name": "distributorNumber",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "autodate2990389176",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": false,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "autodate3332085495",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": false,
          "type": "autodate"
        }
      ]
    },
    {
      "id": "pbc_1874485341",
      "name": "datasheets",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.roles:each ?= \"admin\"",
      "viewRule": "@request.auth.roles:each ?= \"admin\"",
      "createRule": "@request.auth.roles:each ?= \"admin\"",
      "updateRule": "@request.auth.roles:each ?= \"admin\"",
      "deleteRule": "@request.auth.roles:each ?= \"admin\"",
      "indexes": [
        "CREATE UNIQUE INDEX `idx_cymkvsfpan` ON `datasheets` (`name`)"
      ],
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
          "help": "",
          "hidden": false,
          "id": "text3208210256",
          "max": 15,
          "min": 15,
          "name": "id",
          "pattern": "^[a-z0-9]+$",
          "presentable": false,
          "primaryKey": true,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "help": "",
          "hidden": false,
          "id": "text1579384326",
          "max": 0,
          "min": 0,
          "name": "name",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "help": "",
          "hidden": false,
          "id": "file2359244304",
          "maxSelect": 0,
          "maxSize": 0,
          "mimeTypes": [
            "application/pdf"
          ],
          "name": "file",
          "presentable": false,
          "protected": false,
          "required": false,
          "system": false,
          "thumbs": [],
          "type": "file"
        },
        {
          "exceptDomains": [],
          "help": "",
          "hidden": false,
          "id": "url4101391790",
          "name": "url",
          "onlyDomains": [],
          "presentable": false,
          "required": false,
          "system": false,
          "type": "url"
        },
        {
          "hidden": false,
          "id": "autodate2990389176",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": false,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "autodate3332085495",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": false,
          "type": "autodate"
        }
      ]
    },
    {
      "id": "pbc_1219621782",
      "name": "tags",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.roles:each ?= \"admin\"",
      "viewRule": "@request.auth.roles:each ?= \"admin\"",
      "createRule": "@request.auth.roles:each ?= \"admin\"",
      "updateRule": "@request.auth.roles:each ?= \"admin\"",
      "deleteRule": "@request.auth.roles:each ?= \"admin\"",
      "indexes": [
        "CREATE UNIQUE INDEX `idx_k2vsxire2l` ON `tags` (lower(`name`))"
      ],
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
          "help": "",
          "hidden": false,
          "id": "text3208210256",
          "max": 15,
          "min": 15,
          "name": "id",
          "pattern": "^[a-z0-9]+$",
          "presentable": false,
          "primaryKey": true,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "help": "",
          "hidden": false,
          "id": "text1579384326",
          "max": 0,
          "min": 0,
          "name": "name",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "autodate2990389176",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": false,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "autodate3332085495",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": false,
          "type": "autodate"
        }
      ]
    },
    {
      "id": "pbc_1566334308",
      "name": "tagsPartsCountView",
      "type": "view",
      "system": false,
      "listRule": "@request.auth.roles:each ?= \"admin\"",
      "viewRule": "@request.auth.roles:each ?= \"admin\"",
      "createRule": null,
      "updateRule": null,
      "deleteRule": null,
      "indexes": [],
      "fields": [
        {
          "autogeneratePattern": "",
          "help": "",
          "hidden": false,
          "id": "text3208210256",
          "max": 0,
          "min": 0,
          "name": "id",
          "pattern": "^[a-z0-9]+$",
          "presentable": false,
          "primaryKey": true,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "help": "",
          "hidden": false,
          "id": "_clone_mrAC",
          "max": 0,
          "min": 0,
          "name": "name",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "help": "",
          "hidden": false,
          "id": "number1670735344",
          "max": null,
          "min": null,
          "name": "partCount",
          "onlyInt": true,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "_clone_D7EA",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": false,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "_clone_XXQQ",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": false,
          "type": "autodate"
        }
      ],
      "viewQuery": "SELECT\n  t.id,\n  t.name,\n  CAST(COALESCE(u.partCount, 0) AS INT) AS partCount,\n  t.created,\n  t.updated\nFROM tags t\nLEFT JOIN (\n  SELECT je.value AS tagId, COUNT(DISTINCT p.id) AS partCount\n  FROM parts p, json_each(p.tags) je\n  GROUP BY je.value\n) u ON u.tagId = t.id\n"
    }
  ];

  app.importCollections(snapshot, false);
}, (app) => {
  // No-op: this is the baseline the later migrations build on.
});
