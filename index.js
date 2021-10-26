const validators = require("../validation")
const app = require("@live-change/framework").app()

require('../../i18n/ejs-require.js')
const i18n = require('../../i18n')

const definition = app.createServiceDefinition({
  name: 'smsapi',
  eventSourcing: true,
  validators
})

const SMSAPI = require('smsapi')
const smsapi = new SMSAPI({
  oauth: {
    accessToken: process.env.SMSAPI_ACCESS_TOKEN
  }
})

const SentSms = definition.model({
  name: "SentSms",
  properties: {
    phone: {
      type: Object
    },
    text: {
      type: String
    },
    error: {
      type: Object
    },
    result: {
      type: Object
    }
  }
})

definition.trigger({
  name: "sendSms",
  properties: {
    smsId: {
      type: String
    },
    phone: {
      type: String,
      validation: ['nonEmpty']
    },
    text: {
      type: String,
      validation: ['nonEmpty']
    }
  },
  async execute({ smsId, phone, text}, context, emit) {
    if(!smsId) smsId = app.generateUid()
    if(phone == "+4823232323") {
      console.log("TEST SMS", text)
      emit({
        type: 'sent',
        phone, text, smsId: 'test-' + smsId,
        result: 'test-sms'
      })
      return "test-sms-sent"
    }
   // return new Promise((resolve, reject) => {
      smsapi.message
          .sms()
          .from(process.env.SMS_FROM || 'Eco')
          .dataEncoding('utf8')
          .to(phone)
          .maxParts(10)
          .message(text)
          .execute()
          .then( info => {
            emit({
              type: 'sent',
              phone, text, smsId,
              result: info
            })
            //resolve("sent")
          })
          .catch((error) => {
            emit({
              type: 'error',
              phone, text, smsId,
              error
            })
            console.log("SMS ERROR", error)
            //reject("sendFailed")
          })
  //  })
  }
})

definition.event({
  name: "sent",
  properties: {
    smsId: {
      type: String
    },
    phone: {
      type: String
    },
    text: {
      type: String
    },
    result: {
      type: Object
    }
  },
  async execute({ smsId, phone, text, result }) {
    if(!smsId) smsId = app.generateUid()
    await SentSms.create({ id: smsId, phone, text, result })
  }
})


definition.event({
  name: "error",
  properties: {
    smsId: {
      type: String
    },
    phone: {
      type: String
    },
    text: {
      type: String
    },
    error: {
      type: Object
    }
  },
  async execute({ smsId, phone, text, error }) {
    if(!smsId) smsId = app.generateUid()
    await SentSms.create({ id: smsId, phone, text, error })
  }
})

module.exports = definition

async function start () {
  if(!app.dao) {
    await require('@live-change/server').setupApp({})
    await require('@live-change/elasticsearch-plugin')(app)
  }

  process.on('unhandledRejection', (reason, p) => {
    console.log('Unhandled Rejection at: Promise', p, 'reason:', reason)
  })

  app.processServiceDefinition(definition, [...app.defaultProcessors])
  await app.updateService(definition)//, { force: true })
  const service = await app.startService(definition, { runCommands: true, handleEvents: true })

  /*require("../config/metricsWriter.js")(definition.name, () => ({

  }))*/
}

if (require.main === module) start().catch(error => {
  console.error(error)
  process.exit(1)
})

