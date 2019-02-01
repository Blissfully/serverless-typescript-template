"use strict"

const mime = require("mime-types")
const { keyBy, partition } = require("lodash")
// const dump = require("./dump")
const cheerio = require("cheerio")

const multipart = {
  related: "multipart/related",
  alternative: "multipart/alternative",
  mixed: "multipart/mixed",
}

const text = { plain: "text/plain", html: "text/html" }

// Good reference here: http://stackoverflow.com/a/23853079/224872
module.exports = message =>
  (message.payload.parts || [ message.payload ]).reduce((acc, part) => acc.concat(getDocuments(part)), [])

const getDocuments = part => {
  switch (mimeType(part)) {
    case multipart.mixed:
      return part.parts.map(getDocuments)
    case multipart.alternative:
      const byType = keyBy(part.parts, mimeType)
      return getDocuments(byType[multipart.related] || byType[text.html] || byType[text.plain])
    case multipart.related:
      let [ [ html ], nonHtml ] = partition(part.parts, isHtml)
      if (html) {
        const document = partAsDocument(html)
        document.assets = nonHtml.map(partAsDocument)
        fixContentId(document)
        return document
      } else {
        return nonHtml.map(getDocuments)
      }
    case text.html:
      const document = partAsDocument(part)
      fixContentId(document)
      return document
    default:
      return partAsDocument(part)
  }
}

const mimeType = part => part.mimeType || getHeader(part.headers, "Content-Type").split(";")[0]
const isHtml = part => mimeType(part) === text.html

const partAsDocument = part => {
  const name = part.filename || `index.${extension(part)}`

  let contents = new Buffer(part.body.data, "base64")
  console.assert(part.body.size === contents.length, "Decoding error")
  // contents = `... ${contents.length} bytes ...` // Uncomment to make log readable

  const document = {
    name,
    contents,
    assets: [],
  }

  let alias = getHeader(part.headers || [], "Content-ID")
  alias = !!alias ? `cid_${alias.replace(/[<>]/g, "")}` : null
  alias = alias === name ? null : alias
  if (alias) {
    document.alias = alias
  }

  return document
}

const getHeader = (headers, name) => {
  const header = headers.find(header => header.name.toLowerCase() === name.toLowerCase())
  return header ? header.value : ""
}
const extension = part => mime.extension(mimeType(part))

// HACK: Without this step, Chrome and wkhtmlpdf won't load images because cid: is a _protocol_ but we just dump files in the same directory.
// TODO: 15b527190d2ace8d.json (bill.com) sends multipart/mixed with images as separate parts and without content types. Without special handling, the HTML won't be able to find the image at render time.
const fixContentId = document => {
  const $ = cheerio.load(document.contents)
  $("img[src^='cid:']").each((i, el) => {
    el = $(el)
    el.attr("src", el.attr("src").replace(/cid:/, "cid_"))
  })
  document.contents = $.html()
}
