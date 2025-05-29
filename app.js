const axios = require('axios');
const express = require('express');
const multer = require('multer');
const { Dropbox } = require('dropbox');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ dest: 'uploads/' });

const MydropboxAppKey = '72k4rjgio5xik7f';
const MydropboxAppSecret = '5qkialtd2pmpu4y';
const authCode = 'P6SxvwI4BIUAAAAAAAAAMf5Wetxn6bqrg6p5a0Un71s';

let accessToken = null;
let dbx = new Dropbox({});

axios.post('https://api.dropboxapi.com/oauth2/token', {
  grant_type: 'authorization_code',
  code: authCode,
  client_id: MydropboxAppKey,
  client_secret: MydropboxAppSecret,
}, {
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  transformRequest: [(data) => {
    return Object.keys(data).map((key) => {
      return `${key}=${data[key]}`;
    }).join('&');
  }],
})
.then((response) => {
  accessToken = response.data.access_token;
  dbx = new Dropbox({ accessToken });

  // Rest of your code...
  const counterFile = 'textFileCounter.json';

  // Initialize the counter
  if (!fs.existsSync(counterFile)) {
    fs.writeFileSync(counterFile, JSON.stringify({ counter: 1 }));
  }

  function getTextFileCounter() {
    const data = fs.readFileSync(counterFile, 'utf8');
    return JSON.parse(data).counter;
  }

  function incrementTextFileCounter() {
    const counter = getTextFileCounter() + 1;
    fs.writeFileSync(counterFile, JSON.stringify({ counter }));
    return counter;
  }

  app.get('/home', (req, res) => {
    fs.readFile('index.html', (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Error loading index.html');
      } else {
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end(data);
      }
    });
  });

  app.use(express.static(__dirname));

  app.post('/upload', upload.any(), async (req, res) => {
    try {
      console.log(req.files);
      console.log(req.body);

      if (!req.files) {
        res.status(400).send('No files uploaded');
        return;
      }

      req.files.forEach(async (file) => {
        try {
          const fileBuffer = fs.readFileSync(file.path);
          await dbx.filesUpload({
            path: `/Apps/File-Uploader2025/${file.originalname}`,
            contents: fileBuffer,
            mode: 'add',
          });

          console.log('File uploaded successfully');
          fs.unlinkSync(file.path); // Remove the temporary file
        } catch (error) {
          console.error('Error uploading file:', error);
        }
      });

      let textFileCounter = getTextFileCounter();
      const textKeys = Object.keys(req.body).filter(key => key.startsWith('text'));
      for (let i = 0; i < textKeys.length; i++) {
        const key = textKeys[i];
        const textBuffer = Buffer.from(req.body[key], 'utf8');
        const textFileName = `/Apps/File-Uploader2025/text${textFileCounter}.txt`;
        console.log(`Uploading text file: ${textFileName}`);

        try {
          await dbx.filesUpload({
            path: textFileName,
            contents: textBuffer,
            mode: 'add',
          });

          console.log('Text file uploaded successfully');
        } catch (error) {
          console.error('Error uploading text file:', error);
        }

        textFileCounter++;
      }
      fs.writeFileSync(counterFile, JSON.stringify({ counter: textFileCounter }));

      res.send(`Files and texts uploaded successfully!`);
    } catch (error) {
      console.error('Error uploading files or texts:', error);
      res.status(500).send(`Error uploading files or texts.`);
    }
  });

  app.listen(3000, () => {
    console.log('Server listening on port 3000');
  });
})
.catch((error) => {
  console.error('Error exchanging authorization code:', error);
});
