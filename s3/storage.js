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
function donwloadFileApp(url,name) {
  try {
    // Realizar una solicitud para obtener el archivo desde la URL
    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`)
        }
        return response.blob()
      })
      .then((blob) => {
        // Crear un nuevo Blob con el nombre deseado
        const newBlob = new Blob([blob], { type: blob.type })

        // Guardar el Blob con el nuevo nombre usando FileSaver.js
        FileSaver.saveAs(newBlob, name)
      })
      .catch((error) => {
        console.error('Error al descargar el archivo:', error)
      })
  } catch (error) {
    console.error('Error general:', error)
  }
}
module.exports = { uploadFile, downloadFile,donwloadFileApp }
