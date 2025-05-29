 document.getElementById('Create_group').addEventListener('click', function () {
    window.location.href = 'createGroup.html';
  });

  const resourceForm = document.getElementById('resourceForm');
  const resourceList = document.getElementById('resourceList');
  const pdfPreview = document.getElementById('pdfPreview');

  let resources = [];

  function displayResources() {
    if (resources.length === 0) {
      resourceList.innerHTML = `
        <h2 class="section-title">Resources List</h2>
        <p class="no-pdf-animation">No PDFs uploaded yet.</p>
      `;
      pdfPreview.innerHTML = ''; // Clear any preview
      return;
    }

    let listHTML = '<h2 class="section-title">Resources List</h2>';
    listHTML += resources.map((res, index) => `
      <div class="resource-item">
        <div class="resource-title">${res.title}</div>
        <button class="preview-btn" data-index="${index}">Preview</button>
      </div>
    `).join('');

    resourceList.innerHTML = listHTML;

    document.querySelectorAll('.preview-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.getAttribute('data-index'), 10);
        const url = resources[index].fileURL;
        window.open(url, '_blank'); // Open in new tab
      });
    });
  }

  function previewPDF(index) {
    const resource = resources[index];

    pdfPreview.innerHTML = ''; // Clear previous

    const iframe = document.createElement('iframe');
    iframe.src = `${resource.fileURL}#toolbar=0&navpanes=0&scrollbar=0`;
    iframe.title = resource.title;
    iframe.allowFullscreen = true;
    iframe.classList.add('pdf-slide-in'); // Trigger animation

    pdfPreview.appendChild(iframe);
  }

  resourceForm.addEventListener('submit', e => {
    e.preventDefault();

    const title = document.getElementById('resourceTitle').value.trim();
    const fileInput = document.getElementById('resourceFile');
    const file = fileInput.files[0];

    if (!file) {
      alert('Please select a PDF file.');
      return;
    }

    if (file.type !== 'application/pdf') {
      alert('Only PDF files are allowed.');
      return;
    }

    const fileURL = URL.createObjectURL(file);
    resources.push({ title, fileURL });

    displayResources();                 // update list
    previewPDF(resources.length - 1);  // show preview

    resourceForm.reset();
  });