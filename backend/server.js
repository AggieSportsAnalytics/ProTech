const express = require('express');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const xlsx = require('xlsx');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(fileUpload());

app.post('/upload', async (req, res) => {
    try {
        const uploadedFile = req.files?.file;

        if (!uploadedFile) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const isSupportedFile =
            uploadedFile.name.endsWith('.csv') ||
            uploadedFile.name.endsWith('.xlsx') ||
            uploadedFile.name.endsWith('.xls');

        if (!isSupportedFile) {
            return res.status(400).json({ message: 'Only CSV, XLS, or XLSX files are allowed' });
        }

        const workbook = xlsx.read(uploadedFile.data, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        res.json({ data });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

