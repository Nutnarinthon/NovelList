# NovelList

เว็บ static สำหรับเก็บรายการนิยายและจำนวนตอนที่อ่าน โดยใช้ Google Apps Script เป็น API และ Google Sheet เป็นฐานข้อมูล

## Files

- `index.html` — หน้าเว็บและ client-side logic
- `style.css` — รูปแบบหน้าเว็บ
- `code.gs` — Google Apps Script API

## Deploy Google Apps Script

1. สร้าง Google Sheet แล้วเปิด Extensions > Apps Script
2. นำเนื้อหา `code.gs` ไปใส่ใน Apps Script project ที่ผูกกับ Sheet
3. เรียก `setupNovelSheet()` หนึ่งครั้งและอนุญาตสิทธิ์
4. Deploy เป็น Web app และกำหนดสิทธิ์ผู้เข้าถึงตามการใช้งานจริง
5. นำ deployment URL ไปแทนค่า `API` ใน `index.html`

เมื่อแก้ `code.gs` ต้องสร้าง deployment version ใหม่ มิฉะนั้นหน้าเว็บจะยังเรียก backend เวอร์ชันเดิม

## Deploy frontend

เปิดใช้ GitHub Pages จาก branch ที่เก็บ `index.html` และ `style.css` หน้าเว็บต้องเรียก Apps Script ผ่าน HTTPS

## Security

อย่าฝังรหัสลับใน JavaScript ฝั่ง browser หาก Web app เปิดให้ `Anyone` ใช้งาน ผู้ที่ทราบ URL สามารถเรียก API ได้ จึงควรจำกัด deployment ให้เหมาะกับข้อมูลและผู้ใช้งาน
