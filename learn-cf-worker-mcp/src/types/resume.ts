// Generic confidence field type for all extractable fields
export interface ConfidenceField<T> {
  value: T;
  confidence: number;
  standardization: string | null;
}

// Request types
export interface ResumeParserRequest {
  resumeText: string;
  options?: ResumeParserOptions;
}

export interface ResumeParserOptions {
  confidenceThreshold?: number;
  standardizationEnabled?: boolean;
  extractSummary?: boolean;
  sectionPriorities?: string[];
  extractLanguages?: boolean;
}

// Enhanced schema with confidence scoring
export interface PersonalInfo {
  name: ConfidenceField<string>;
  email: ConfidenceField<string>;
  phone: ConfidenceField<string>;
  location: ConfidenceField<string | null>;
  linkedin: ConfidenceField<string | null>;
  github: ConfidenceField<string | null>;
  website: ConfidenceField<string | null>;
  summary: ConfidenceField<string | null>;
}

export interface Skill {
  name: ConfidenceField<string>;
  category: ConfidenceField<string | null>;
  proficiency: ConfidenceField<string | null>;
  yearsOfExperience: ConfidenceField<number | null>;
}

export interface DateRange {
  startDate: ConfidenceField<string | null>;
  endDate: ConfidenceField<string | null>;
  durationInMonths: ConfidenceField<number | null>;
  current: ConfidenceField<boolean>;
}

export interface WorkExperience {
  company: ConfidenceField<string>;
  title: ConfidenceField<string>;
  location: ConfidenceField<string | null>;
  dates: DateRange;
  responsibilities: ConfidenceField<string[]>;
  technologies: ConfidenceField<string[]>;
  achievements: ConfidenceField<string[]>;
}

export interface Education {
  institution: ConfidenceField<string>;
  degree: ConfidenceField<string>;
  field: ConfidenceField<string>;
  dates: DateRange;
  gpa: ConfidenceField<string | null>;
  coursework: ConfidenceField<string[] | null>;
  achievements: ConfidenceField<string[] | null>;
}

export interface Project {
  name: ConfidenceField<string>;
  description: ConfidenceField<string>;
  technologies: ConfidenceField<string[]>;
  urls: ConfidenceField<string[] | null>;
  dates: ConfidenceField<DateRange | null>;
  role: ConfidenceField<string | null>;
}

export interface Certification {
  name: ConfidenceField<string>;
  issuer: ConfidenceField<string | null>;
  date: ConfidenceField<string | null>;
  expiryDate: ConfidenceField<string | null>;
  id: ConfidenceField<string | null>;
}

export interface Language {
  name: ConfidenceField<string>;
  proficiency: ConfidenceField<string | null>;
}

// Main resume data structure
export interface ParsedResume {
  personalInfo: PersonalInfo;
  skills: Skill[];
  workExperience: WorkExperience[];
  education: Education[];
  projects: Project[];
  certifications: Certification[];
  languages: Language[];
  overallConfidence: number;
  missingFields: string[];
  detectedSections: string[];
}

// Response interface
export interface ParseResumeResponse {
  success: boolean;
  data?: ParsedResume;
  error?: {
    message: string;
    code: string;
    details?: unknown;
  };
}

// For backward compatibility with existing code
export type ContactDetails = PersonalInfo;
export type ResumeData = ParsedResume;