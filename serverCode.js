const fileInputs = document.querySelectorAll('input[type="file"]');
const sendButton = document.getElementById('sendBTN');
const statusDiv = document.getElementById('status');
const textInputs = document.getElementsByClassName('textinput');

sendButton.addEventListener('click', async (event) => {
  event.preventDefault();
  const formData = new FormData();
  Array.from(fileInputs).forEach((fileInput, index) => {
    if (fileInput.files.length > 0) {
      formData.append(`file${index}`, fileInput.files[0]);
    }
  });
  Array.from(textInputs).forEach((textInput, index) => {
    formData.append(`text${index}`, textInput.value);
  });

  try {
    const response = await fetch('http://localhost:3000/upload', {
    method: 'POST',
    body: formData,
});

    const result = await response.text();
    statusDiv.innerText = result;
  } catch (error) {
    console.error(error);
    statusDiv.innerText = 'Error uploading files';
  }
});