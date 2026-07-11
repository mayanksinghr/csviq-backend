import "dotenv/config";
import { extractCrmBatch } from "./services/geminiExtractor.service";
import { shouldSkipRecord } from "./validators/crmRecord.schema";
import { retryWithBackoff } from "./utils/retry";

async function main() {
  const testRows: Record<string, string>[] = [
    {
      Name: "Rahul Sharma",
      Contact_No: "9876543210 / 9123456789",
      Email_Address: "rahul@test.com, rahul.alt@test.com",
      City: "Delhi",
      Status: "interested, follow up next week",
    },
    {
      Name: "No Contact Person",
      City: "Mumbai",
      Notes: "walked in, no phone or email given",
    },
    {
      "Full Name": "Priya Verma",
      "Phone": "+91 9988776655",
      "Email": "priya.verma@gmail.com",
      "Project": "Sarjapur Plots",
      "Lead Status": "Sale done - booked 2BHK",
      "Created": "2026-05-13 14:20:48",
      "Owner": "Amit Singh",
    },
    {
      Name: "Vikram Nair",
      Mobile: "9123456780",
      Email: "",
      City: "Bangalore",
      State: "Karnataka",
      Country: "India",
      Source: "Meridian Tower FB campaign",
      Remarks: "Did not connect, called twice no answer",
    },
    {
      "Contact Name": "Ananya Roy",
      "Contact Number": "9000011111, 9000022222",
      "Email ID": "ananya@company.co.in",
      "Company Name": "Roy Enterprises",
      "Possession": "Ready to move",
      "CRM Note": "Bad lead - fake enquiry",
    },
    {
      Name: "",
      Phone: "9876500000",
      City: "Pune",
      Query: "Interested in Eden Park 3BHK, budget 80L",
    },
    {
      Name: "Suresh Kumar",
      "Alt Contact": "8888899999",
      "Alt Email": "suresh.k@yahoo.com, s.kumar@outlook.com",
      Location: "Hyderabad",
      Notes: "Varah Swamy project lead, follow up next Monday, possession within 6 months",
    },
  ];

  const result = await retryWithBackoff(
    () => extractCrmBatch({ rows: testRows, batchStartIndex: 0 }),
    { maxRetries: 1, baseDelayMs: 1000 }
  );

  for (const item of result.results) {
    const skip = shouldSkipRecord(item.record);
    console.log(`Row ${item.sourceRowIndex} | skip: ${skip}`);
    console.log(JSON.stringify(item, null, 2));
  }

  console.log(`\nTotal rows: ${testRows.length}`);
  console.log(`Imported: ${result.results.filter(r => !shouldSkipRecord(r.record)).length}`);
  console.log(`Skipped: ${result.results.filter(r => shouldSkipRecord(r.record)).length}`);
}

main().catch(console.error);