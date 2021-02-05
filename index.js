const App = require("@live-change/framework")
const validators = require("../validation")
const app = new App()

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
   // return new Promise((resolve, reject) => {
      smsapi.message
          .sms()
          .from('Eco')
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
    await SentSms.create({ id: smsId, phone, text, error })
  }
})

module.exports = definition

async function start () {
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

