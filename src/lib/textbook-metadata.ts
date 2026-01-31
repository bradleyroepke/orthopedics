// Full metadata for textbooks to display proper titles and authors
// Key is the filename (without extension), value is the display metadata

export interface TextbookMetadata {
  title: string;
  subtitle?: string;
  author: string;
  edition: string;
  year: number;
}

export const TEXTBOOK_METADATA: Record<string, TextbookMetadata> = {
  'Buckley_AO Principles of Fracture Management_3rd Edition_2018': {
    title: 'AO Principles of Fracture Management',
    subtitle: 'Principles and Methods',
    author: 'Buckley RE, Moran CG, Apivatthakakul T',
    edition: '3rd Edition',
    year: 2018,
  },
  'Burkhart_View of the Shoulder_1st Edition_2006': {
    title: "Burkhart's View of the Shoulder",
    subtitle: "A Cowboy's Guide to Advanced Shoulder Arthroscopy",
    author: 'Burkhart SS',
    edition: '1st Edition',
    year: 2006,
  },
  "Canale_Campbell's Core Orthopaedic Procedures_1st Edition_2015": {
    title: "Campbell's Core Orthopaedic Procedures",
    author: 'Canale ST, Beaty JH, Azar FM',
    edition: '1st Edition',
    year: 2015,
  },
  'Clayton_Leonardo da Vinci The Mechanics of Man_1st Edition_2012': {
    title: 'Leonardo da Vinci: The Mechanics of Man',
    author: 'Clayton M, Philo R',
    edition: '1st Edition',
    year: 2012,
  },
  'Codman_The Shoulder_1st Edition_1934': {
    title: 'The Shoulder',
    subtitle:
      'Rupture of the Supraspinatus Tendon and Other Lesions In or About the Subacromial Bursa',
    author: 'Codman EA',
    edition: '1st Edition',
    year: 1934,
  },
  'Franceschi_Revision Shoulder Arthroplasty_1st Edition_2024': {
    title: 'Revision Shoulder Arthroplasty',
    author: 'Franceschi F, Athwal GS, Lädermann A, Giovannetti de Sanctis E',
    edition: '1st Edition',
    year: 2024,
  },
  'Frankle_Reverse Shoulder Arthroplasty_1st Edition_2015': {
    title: 'Reverse Shoulder Arthroplasty',
    subtitle: 'Biomechanics, Clinical Techniques, and Current Technologies',
    author: 'Frankle M, Marberry S, Pupello D',
    edition: '1st Edition',
    year: 2015,
  },
  'Gartsman_Shoulder Arthroplasty_1st Edition_2008': {
    title: 'Shoulder Arthroplasty',
    author: 'Gartsman GM, Edwards TB',
    edition: '1st Edition',
    year: 2008,
  },
  'Hoppenfeld_Surgical Exposures in Orthopaedics_4th Edition_2009': {
    title: 'Surgical Exposures in Orthopaedics',
    subtitle: 'The Anatomic Approach',
    author: 'Hoppenfeld S, deBoer P, Buckley R',
    edition: '4th Edition',
    year: 2009,
  },
  'Kapandji_The Physiology of Joints_6th Edition_2010': {
    title: 'The Physiology of Joints',
    subtitle: 'Annotated Diagrams of the Mechanics of the Human Joints',
    author: 'Kapandji AI',
    edition: '6th Edition',
    year: 2010,
  },
  'Le_High Yield Orthopaedics OITE Review_1st Edition_2019': {
    title: 'High-Yield Orthopaedics',
    subtitle: 'OITE & ABOS Review for Orthopaedic Providers',
    author: 'Le HV',
    edition: '1st Edition',
    year: 2019,
  },
  'Matsen_The Shoulder_4th Edition_2009': {
    title: "Rockwood and Matsen's The Shoulder",
    author: 'Matsen FA, Lippitt SB, DeBartolo SE',
    edition: '4th Edition',
    year: 2009,
  },
  'Mont_Orthopaedic Knowledge Update Hip and Knee Reconstruction_5th Edition_2018':
    {
      title: 'Orthopaedic Knowledge Update',
      subtitle: 'Hip and Knee Reconstruction',
      author: 'Mont MA, Tanzer M',
      edition: '5th Edition',
      year: 2018,
    },
  'Morrey_Joint Replacement Arthroplasty Elbow and Shoulder_4th Edition_2010': {
    title: 'Joint Replacement Arthroplasty',
    subtitle: 'Basic Science, Elbow, and Shoulder',
    author: 'Morrey BF, An KN, Sperling JW',
    edition: '4th Edition',
    year: 2010,
  },
  'Morrey_Master Techniques Relevant Surgical Exposures_2nd Edition_2007': {
    title: 'Master Techniques in Orthopaedic Surgery',
    subtitle: 'Relevant Surgical Exposures',
    author: 'Morrey BF, Morrey MC',
    edition: '2nd Edition',
    year: 2007,
  },
  "Tornetta_Rockwood and Green's Fractures in Adults_9th Edition_2019": {
    title: "Rockwood and Green's Fractures in Adults",
    author: 'Tornetta P, Ricci WM, Court-Brown CM, McQueen MM, McKee M',
    edition: '9th Edition',
    year: 2019,
  },
  'Walch_Shoulder Arthroplasty_1st Edition_1999': {
    title: 'Shoulder Arthroplasty',
    author: 'Walch G, Boileau P',
    edition: '1st Edition',
    year: 1999,
  },
  'Zuckerman_Disorders of the Shoulder_3rd Edition_2013': {
    title: 'Disorders of the Shoulder',
    subtitle: 'Diagnosis and Management',
    author: 'Zuckerman JD, Iannotti JP, Williams GR, Miniaci A',
    edition: '3rd Edition',
    year: 2013,
  },
};

// Helper function to get textbook metadata from filename
export function getTextbookMetadata(filename: string): TextbookMetadata | null {
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
  return TEXTBOOK_METADATA[nameWithoutExt] || null;
}

// Parse textbook filename to extract basic info if not in metadata
export function parseTextbookFilename(filename: string): {
  author: string;
  title: string;
  edition: string;
  year: number | null;
} {
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
  const parts = nameWithoutExt.split('_');

  if (parts.length >= 4) {
    // Format: Author_Title_Edition_Year
    const author = parts[0];
    const title = parts[1];
    const edition = parts[2];
    const yearMatch = parts[3].match(/\d{4}/);
    const year = yearMatch ? parseInt(yearMatch[0]) : null;

    return { author, title, edition, year };
  }

  return {
    author: parts[0] || 'Unknown',
    title: parts.slice(1).join(' ') || nameWithoutExt,
    edition: '',
    year: null,
  };
}
