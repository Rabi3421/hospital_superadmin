import HospitalDepartment from "@/models/HospitalDepartment";
import HospitalGallery from "@/models/HospitalGallery";
import HospitalNotice from "@/models/HospitalNotice";
import HospitalWebsitePage from "@/models/HospitalWebsitePage";

type StarterHospital = {
  hospitalId: string;
  name: string;
  type: string;
  city: string;
};

export const starterWebsitePages = [
  ["home", "Homepage", "Welcome", "Care that keeps you connected", "Explore departments, find doctors, request appointments, and access patient services from one place."],
  ["about", "About", "About", "Care with clarity and compassion", "Learn about our hospital, our approach to care, and the services available to patients."],
  ["services", "Services", "Services", "Hospital services and departments", "Explore the active care departments published by this hospital."],
  ["departments", "Departments", "Departments", "Clinical departments", "Explore active departments and find the right care team."],
  ["doctors", "Doctors", "Doctors", "Meet our doctors", "Find active doctors and specialists published by this hospital."],
  ["book-appointment", "Book Appointment", "Book an appointment", "Schedule your visit", "Choose an available slot or send a request for the hospital team to confirm."],
  ["contact", "Contact", "Contact", "Contact the hospital", "Send an enquiry to the hospital team."],
  ["notices", "Notices", "Notices", "Hospital notices", "Read the latest public announcements from the hospital."],
  ["gallery", "Gallery", "Gallery", "Hospital gallery", "Explore facilities, care spaces, and moments published by the hospital."],
  ["faq", "FAQ", "FAQ", "Answers before your visit", "Practical information about appointments, services, and the patient portal."],
  ["testimonials", "Testimonials", "Patient stories", "Patient experiences", "Read stories and feedback published by the hospital."],
  ["privacy-policy", "Privacy Policy", "Legal", "Privacy policy", "Learn how the hospital handles personal information."],
  ["terms-of-service", "Terms of Service", "Legal", "Terms of service", "Review the terms that apply when using this website."],
  ["hipaa-notice", "Health Information Notice", "Legal", "Health information notice", "Review information about health data and patient privacy."],
] as const;

export async function seedHospitalWebsiteStarter(hospital: StarterHospital) {
  const pageOperations = starterWebsitePages.map(([pageKey, label, eyebrow, title, description]) => ({
    updateOne: {
      filter: { hospitalId: hospital.hospitalId, pageKey },
      update: {
        $setOnInsert: {
          hospitalId: hospital.hospitalId,
          pageKey,
          label,
          status: "Published" as const,
          content: {
            eyebrow,
            title: pageKey === "home" ? `${hospital.name}: ${title}` : title,
            description,
            summary: description,
            sectionTitle: title,
            sectionDescription: description,
            emptyMessage: `Content for ${label.toLowerCase()} will be updated soon.`,
            ctaLabel: "Book appointment",
          },
        },
      },
      upsert: true,
    },
  }));

  await Promise.all([
    HospitalWebsitePage.bulkWrite(pageOperations),
    HospitalDepartment.bulkWrite(
      [
        ["General Medicine", "Primary consultations, preventive care, and ongoing health support.", "Primary Care", "https://images.unsplash.com/photo-1538108149393-fbbd81895907"],
        ["Diagnostics", "Clinical assessments and diagnostic support coordinated with your care team.", "Diagnostics", "https://images.unsplash.com/photo-1586773860418-d37222d8fce3"],
        ["Emergency Care", "Urgent assessment and care guidance when immediate attention is needed.", "Urgent Care", "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d"],
      ].map(([name, description, tag, imageUrl], sortOrder) => ({
        updateOne: {
          filter: { hospitalId: hospital.hospitalId, name },
          update: { $setOnInsert: { hospitalId: hospital.hospitalId, name, description, tag, imageUrl, status: "Active", sortOrder } },
          upsert: true,
        },
      })),
    ),
    HospitalNotice.updateOne(
      { hospitalId: hospital.hospitalId, title: `Welcome to ${hospital.name}` },
      { $setOnInsert: { hospitalId: hospital.hospitalId, title: `Welcome to ${hospital.name}`, content: `Our website is ready. Explore our services and contact our team for appointments in ${hospital.city}.`, type: "Announcement", status: "Published", publishedAt: new Date() } },
      { upsert: true },
    ),
    HospitalGallery.bulkWrite(
      [
        ["Patient care environment", "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d"],
        ["Hospital facilities", "https://images.unsplash.com/photo-1538108149393-fbbd81895907"],
        ["Connected care team", "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d"],
      ].map(([title, imageUrl], sortOrder) => ({
        updateOne: {
          filter: { hospitalId: hospital.hospitalId, title },
          update: { $setOnInsert: { hospitalId: hospital.hospitalId, title, imageUrl, category: "Hospital", status: "Active", sortOrder } },
          upsert: true,
        },
      })),
    ),
  ]);
}
