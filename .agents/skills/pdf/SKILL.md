---
name: pdf
description: Read, extract, merge, split, fill forms in, or produce PDF files. Use for PDF-related development and document tasks in this repository.
---

# PDF

Work with PDF files: read, extract, fill, merge, split, or produce a PDF.

## Reading and extracting
- Text and tables: run({lang:"python"}) with pypdf (text) or pdfplumber if available (tables). Report page counts and where data came from (page numbers).
- Scanned PDFs have no text layer — say so, and offer OCR via a vision model on page images.

## Creating a PDF
- Preferred: write the content as a workspace doc (<name>.doc.md) or deck (<name>.slides.md) and have the user Export → PDF from the Output tab. It keeps layout, fonts and page breaks consistent.
- Programmatic PDFs (invoices, certificates, many generated files): Python with reportlab if it installs, otherwise generate an HTML page and convert in Node. Always read the result back (page count, size > 0).

## Merging, splitting, rotating, forms
- pypdf: PdfReader/PdfWriter for merge (append pages), split (write page ranges), rotate (page.rotate(90)), metadata.
- Fillable forms: list fields first (reader.get_fields()), map values by exact field name, writer.update_page_form_field_values(...), keep NeedAppearances so viewers render the values. Report any field you could not fill.

## Rules
- Never overwrite the user's original; write to a new file name.
- Never report success for an empty file: check the output size and page count.

## Verification
- Output PDF exists, is larger than 0 bytes, and has the expected page count
- Extracted or filled values are reported with page/field references

## Project compatibility

- The original Electron Hub skill is retained in [pdf.skill.json](pdf.skill.json). Its tool names and Output tab refer to Electron Hub; use the equivalent available tools in the current agent environment. Do not assume those features exist in the web application.
- Check installed tools and dependencies before running PDF operations. This skill does not install packages or grant execution permissions.
- For application features, preserve existing authorization, proposal privacy, private ticket attachments, and customer-safe projections. Keep credentials and private documents out of repository history and logs.
- Follow the project build and test workflow for any future PDF implementation. Do not expose internal costs or supplier credentials in customer documents.
