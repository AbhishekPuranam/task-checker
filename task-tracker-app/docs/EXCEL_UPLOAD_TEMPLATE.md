# Excel Upload Template Guide

## Required Excel File Format

### Column Names (Case-Sensitive)

The Excel file must have the following columns in the **first row** (header row). Column names are **case-sensitive** and should match exactly:

| Column Name | Required | Data Type | Description | Example Values |
|------------|----------|-----------|-------------|----------------|
| **Sl No** | Optional | Number/Text | Serial number | 1, 2, 3... |
| **Structure Number** | Required | Text | Unique structure identifier | H00046, B00100, G00522 |
| **Drawing No** | Optional | Text | Drawing reference number | DRG-001, SK-234 |
| **Level** | Optional | Text | Floor/Level designation | GL, +4.5m, Level 2 |
| **Member Type** | Optional | Text | Type of structural member | Beam, Column, Truss |
| **GridNo** | Optional | Text | Grid reference | A1, B2, C3 |
| **Part Mark No** | Optional | Text | Part marking number | PM-001, MK-123 |
| **Section Sizes** | Optional | Text | Section dimensions | 200x100, UC305x305x97 |
| **Length in (mm)** | Optional | Number | Length in millimeters | 5000, 3500.5 |
| **Qty** | Optional | Number | Quantity | 1, 2, 5 |
| **Section Depth (mm)D** | Optional | Number | Depth in millimeters | 300, 450 |
| **Flange Width (mm) B** | Optional | Number | Flange width in millimeters | 200, 150 |
| **Thickness (mm) t Of Web** | Optional | Number | Web thickness in millimeters | 10, 12.5 |
| **Thickness (mm) TOf Flange** | Optional | Number | Flange thickness in millimeters | 15, 20 |
| **Thickness of Fireproofing** | Optional | Number | Fireproofing thickness | 25, 30 |
| **Surface Area in Sqm** | Optional | Number | Surface area in square meters | 2.5, 3.75 |
| **Fire Proofing Workflow** | Optional | Text | Workflow type for automatic job creation | See below |

### Alternative Column Names

The system also accepts these alternative column names:

- **Sl No**: Can also be "Serial No" or "S.No"
- **Structure Number**: Can also be "Structure No"
- **Drawing No**: Can also be "Drawing Number"
- **Level**: Can also be "Floor"
- **Member Type**: Can also be "Type"
- **GridNo**: Can also be "Grid" or "Grid No"
- **Part Mark No**: Can also be "Part Mark" or "Mark No"
- **Section Sizes**: Can also be "Section"
- **Length in (mm)**: Can also be "Length"
- **Qty**: Can also be "Quantity"
- **Section Depth (mm)D**: Can also be "Depth"
- **Flange Width (mm) B**: Can also be "Width"
- **Thickness (mm) t Of Web**: Can also be "Web Thickness"
- **Thickness (mm) TOf Flange**: Can also be "Flange Thickness"
- **Thickness of Fireproofing**: Can also be "Fireproofing"
- **Surface Area in Sqm**: Can also be "Area"

## Fire Proofing Workflow Values

To automatically create jobs after upload, use one of these **exact values** in the "Fire Proofing Workflow" column:

### Supported Workflows:

1. **cement_fire_proofing**
   - Creates 7 jobs in sequence:
     1. Surface Preparation
     2. Rockwool Filling
     3. Adhesive coat/Primer
     4. Vermiculite-Cement
     5. Thickness inspection
     6. Sealer coat
     7. WIR

2. **gypsum_fire_proofing**
   - Creates 7 jobs in sequence:
     1. Surface Preparation
     2. Rockwool Filling
     3. Adhesive coat/Primer
     4. Vermiculite-Gypsum
     5. Thickness inspection
     6. Sealer coat
     7. WIR

3. **intumescent_coatings**
   - Creates 9 jobs in sequence:
     1. Surface Preparation
     2. Primer
     3. Coat -1
     4. Coat-2
     5. Coat-3
     6. Coat-4
     7. Coat-5
     8. Thickness inspection
     9. Top Coat

4. **refinery_fire_proofing**
   - Creates 12 jobs in sequence:
     1. Scaffolding Errection
     2. Surface Preparation
     3. Primer/Adhesive coat
     4. Mesh
     5. FP 1 Coat
     6. FP Finish coat
     7. Sealer
     8. Top coat Primer
     9. Top coat
     10. Sealant
     11. Inspection
     12. Scaffolding -Dismantling

### Important Notes:
- Values are **case-sensitive** - use lowercase with underscores
- Leave blank if you don't want automatic job creation
- Jobs will be created for each structural element with a workflow assigned
- Invalid workflow values will be ignored (no jobs created)
- All jobs are created with "pending" status
- Jobs are numbered sequentially (order index: 100, 200, 300...)

## Sample Excel File Structure

```
| Sl No | Structure Number | Drawing No | Level | Member Type | GridNo | Fire Proofing Workflow |
|-------|-----------------|------------|-------|-------------|--------|------------------------|
| 1     | H00046          | DRG-001    | GL    | Beam        | A1     | cement_fire_proofing   |
| 2     | B00100          | DRG-002    | +4.5m | Column      | B2     | gypsum_fire_proofing   |
| 3     | G00522          | DRG-003    | L2    | Truss       | C3     | intumescent_coatings   |
| 4     | R00123          | DRG-004    | L3    | Beam        | D4     | refinery_fire_proofing |
```

## Upload Behavior

### Duplicate Detection
- A row is considered a **duplicate** if **ALL** of the following fields match an existing element in the same project:
  - Structure Number
  - Drawing No
  - Level
  - Member Type
  - Grid No
  - Part Mark No
  - Section Sizes
  - All dimensional values (length, qty, depths, widths, thicknesses, area)
  - Fire Proofing Workflow

- Duplicates are **skipped** during upload
- You'll see a summary showing:
  - Total rows parsed
  - Elements saved (new)
  - Duplicates skipped
  - Jobs created

### Job Creation
- Jobs are only created if "Fire Proofing Workflow" column has a valid workflow value
- Each element with a workflow gets multiple jobs based on the workflow type
- Jobs are linked to the structural element
- Jobs are created with "pending" status by default

## Project Requirements

When creating a project before uploading Excel:
- **Project Name**: Required
- **Location**: Optional (will show "Not specified" if empty)
- **Description**: Optional

## Tips for Best Results

1. **Keep column names exact** - Copy from this guide to ensure accuracy
2. **Use consistent data** - Maintain the same format across all rows
3. **Check workflow values** - Make sure they match exactly (lowercase, underscores)
4. **Remove test rows** - Delete any sample/test data before uploading
5. **Check duplicates** - The system will skip exact duplicates to prevent errors
6. **Verify grid numbers** - Grid numbers are used for grouping in the engineer portal

## Common Issues

### No Jobs Created
**Problem**: Upload shows "0 jobs created"
**Solutions**:
- Check if "Fire Proofing Workflow" column exists
- Verify workflow values match exactly: `cement_fire_proofing` or `intumescent_coating`
- Ensure cells are not empty in the workflow column

### Only Few Elements Uploaded
**Problem**: Upload shows fewer elements than rows in Excel
**Reasons**:
- Duplicate rows detected (all fields match)
- Empty rows in Excel file
- Validation errors (check logs)

### Upload Fails
**Problem**: Upload doesn't complete
**Solutions**:
- Ensure file is .xlsx format
- Check file size (should be under 10MB)
- Verify all required columns exist
- Remove any special characters or formulas

## Download Template

A blank template Excel file is available at: `/uploads/templates/structural-elements-template.xlsx`

This template includes:
- All column headers pre-configured
- Sample data row showing expected format
- Comments explaining each column
- Workflow dropdown with valid values
