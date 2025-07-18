class ExcelProcessor {
    static processExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet);
                    
                    // Validate and format the data
                    const formattedData = jsonData.map(row => ({
                        admissionNo: row['Student ID'] || '',
                        studentName: row['Name'] || '',
                        fatherName: row["Father Name"] || '',
                        class: row['Class'] || '',
                        section: row['Section'] || '',
                        rollNo: row['Roll No'] || ''
                    }));

                    resolve(formattedData);
                } catch (error) {
                    reject('Error processing Excel file: ' + error.message);
                }
            };

            reader.onerror = function() {
                reject('Error reading file');
            };

            reader.readAsArrayBuffer(file);
        });
    }
} 