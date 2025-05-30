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
const redirectUri = process.env.NODE_ENV === 'production' ? 'https://betauploaderapp.onrender.com/callback' : 'http://localhost:3000/callback';
let accessToken = null;
let refreshToken = null;
let dbx = new Dropbox({});

app.get('/login', (req, res) => {
  const authorizationUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${MydropboxAppKey}&response_type=code&redirect_uri=${redirectUri}`;
  res.redirect(authorizationUrl);
});

app.get('/callback', async (req, res) => {
  const code = req.query.code;
  try {
    const response = await axios.post('https://api.dropboxapi.com/oauth2/token', {
      grant_type: 'authorization_code',
      code,
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
    });

    accessToken = response.data.access_token;
    refreshToken = response.data.refresh_token;
    dbx = new Dropbox({ accessToken });

    res.send('Access token obtained successfully!');
    startServer();
  } catch (error) {
    console.error('Error exchanging authorization code:', error);
    res.status(500).send('Error exchanging authorization code');
  }
});

const refreshAccessToken = async () => {
  try {
    const response = await axios.post('https://api.dropboxapi.com/oauth2/token', {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
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
    });

    accessToken = response.data.access_token;
    dbx = new Dropbox({ accessToken });
  } catch (error) {
    console.error('Error refreshing access token:', error);
  }
};

const startServer = () => {
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

  app.use(express.static(__dirname));
  
  app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
  });


  const uploadToDropbox = async (filePath, fileName, fileBuffer) => {
    try {
      await dbx.filesUpload({
        path: `/Apps/File-Uploader2025/${fileName}`,
        contents: fileBuffer,
        mode: 'add',
      });

      console.log('File uploaded successfully');
    } catch (error) {
      if (error.error && error.error.error && error.error.error == 'expired_access_token') {
        await refreshAccessToken();
        await uploadToDropbox(filePath, fileName, fileBuffer);
      } else {
        console.error('Error uploading file:', error);
      }
    }
  };

  const uploadTextToDropbox = async (textFileName, textBuffer) => {
    try {
      await dbx.filesUpload({
        path: textFileName,
        contents: textBuffer,
        mode: 'add',
      });

      console.log('Text file uploaded successfully');
    } catch (error) {
      if (error.error && error.error.error && error.error.error == 'expired_access_token') {
        await refreshAccessToken();
        await uploadTextToDropbox(textFileName, textBuffer);
      } else {
        console.error('Error uploading text file:', error);
      }
    }
  };

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
          await uploadToDropbox(file.path, file.originalname, fileBuffer);
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
        const textFileName = textFileName = `/Apps/File-Uploader2025/text${textFileCounter}.txt`;
        console.log(`Uploading text file: ${textFileName}`);

        try {
          await uploadTextToDropbox(textFileName, textBuffer);
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
};

const port = process.env.PORT || 3000;
app.use(express.static(__dirname));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
