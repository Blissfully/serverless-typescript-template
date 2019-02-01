import AWS = require("aws-sdk")

/*
  https://www.awsarchitectureblog.com/2015/03/backoff.html
  Explore in the console with:
  [1,2,3,4,5,6,7,8,9,10].map(fullJitter)
*/
const cap = 30 * 1000
const base = 100
const randomBetween = (min: number, max: number) => Math.random() * (max - min) + min
const fullJitter = (retryCount: number) => {
  const temp = Math.min(cap, Math.pow(base * 2, retryCount))
  return temp / 2 + randomBetween(0, temp / 2)
}

AWS.config.update({
  correctClockSkew: true,
  retryDelayOptions: {
    customBackoff: fullJitter,
  },
})

// AWS.config.setPromisesDependency(require("bluebird"))

export default AWS

// let sdk
// if (process.env._X_AMZN_TRACE_ID) {
//   sdk = require("aws-xray-sdk").captureAWS(AWS)
// } else {
//   sdk = AWS
// }
// export default sdk
