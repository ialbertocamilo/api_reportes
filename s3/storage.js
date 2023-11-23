const fs = require('fs')
const path = require('path');
const { AWS_BUCKET_NAME, MARCA } = require('../config.js')
const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const { CARPETA_DESCARGA } = require("../config");
const { client } = require('../helper/s3-helpers.js')

const uploadFile = async (filePath) => {
  try {
    if(filePath === undefined) return
    const fileName = path.basename(filePath);
    const fileStream = fs.createReadStream(CARPETA_DESCARGA+'/'+fileName)
    console.log(CARPETA_DESCARGA+'/'+fileName)
    const keyFile = MARCA +'/reports/'+ fileName
     console.log(keyFile)
    const compressedCommand = new PutObjectCommand({
      Bucket: AWS_BUCKET_NAME,
      Key: keyFile,
      Body: fileStream,
    })
    await client.send(compressedCommand)
    console.log(`Uploaded successfully! ${keyFile} `)
    fs.unlinkSync(CARPETA_DESCARGA+'/'+fileName)
  } catch (err) {
    console.error(err)
  }
}

function downloadFile(filePath) {
  try{
    if(!filePath ) return
    const expiresIn = 60 * 5
  
    const command = new GetObjectCommand({
      Bucket: AWS_BUCKET_NAME,
      Key: `${MARCA}/reports/${filePath}`,
    })
    const url = getSignedUrl(client, command, { expiresIn })
    return url
  } catch (err) {
    console.log(err)
  }  
  
}

module.exports = { uploadFile, downloadFile }
