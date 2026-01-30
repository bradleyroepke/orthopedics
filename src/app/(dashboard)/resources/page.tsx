"use client";

import { useState } from "react";
import { ExternalLink, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Resource {
  name: string;
  url: string;
  description?: string;
}

interface ResourceCategory {
  title: string;
  resources: Resource[];
}

const LEARNING_RESOURCES: ResourceCategory[] = [
  {
    title: "General",
    resources: [
      { name: "Orthobullets", url: "https://www.orthobullets.com/", description: "Free orthopaedic education and collaboration community" },
      { name: "AAOS ROCK", url: "https://rock.aaos.org/", description: "Resident Orthopaedic Core Knowledge curriculum" },
      { name: "ResStudy", url: "https://www.aaos.org/education/examinations/ResStudy/", description: "AAOS practice exam question bank" },
      { name: "VuMedi", url: "https://www.vumedi.com/orthopaedics/", description: "Surgical video platform for physicians" },
      { name: "Osgenic", url: "https://osgenic.com/", description: "Surgical approaches and anatomy resource" },
      { name: "OrthoPedia", url: "https://www.orthopedia.com/", description: "Arthrex educational video library" },
      { name: "AAOS Orthopaedic Video Theater", url: "https://www.aaos.org/videos", description: "Peer-reviewed surgical technique videos" },
      { name: "Orthoracle", url: "https://www.orthoracle.com/", description: "Online surgical atlas with step-by-step techniques" },
      { name: "UCSF Orthopedic Curriculum", url: "https://orthosurgery.ucsf.edu/education/residency", description: "UCSF residency education resources" },
      { name: "NYU Ortho Digital Library", url: "https://www.ortholibrary.org/", description: "NYU Langone Orthopedic Digital Library" },
    ],
  },
  {
    title: "Billing / Coding",
    resources: [
      { name: "PChong - Ortho CPT Codes", url: "https://pchong.net/cgi-bin/cptortho.cgi", description: "Orthopedic CPT code lookup tool" },
    ],
  },
  {
    title: "Trauma",
    resources: [
      { name: "OTA Core Curriculum Lectures", url: "https://education.ota.org/core-curriculum-lectures", description: "Orthopaedic Trauma Association lecture series" },
      { name: "OrthoClips", url: "https://www.orthoclips.com/", description: "Multimedia orthopaedic academy" },
    ],
  },
  {
    title: "Shoulder / Elbow",
    resources: [
      { name: "The Shoulder and Elbow Page", url: "https://faculty.washington.edu/alexbert/Shoulder/", description: "UW comprehensive shoulder and elbow resource" },
      { name: "Shoulderdoc", url: "https://shoulderdoc.co.uk/", description: "Shoulder symptoms, treatment, and research" },
      { name: "ASES", url: "https://ases.pathlms.com/", description: "American Shoulder and Elbow Surgeons education" },
    ],
  },
  {
    title: "Hand",
    resources: [
      { name: "Hand.e (ASSH)", url: "https://www.assh.org/hande/s/", description: "Hand surgery video curriculum from ASSH" },
      { name: "Wash U Surgical Education", url: "https://surgicaleducation.wustl.edu/", description: "Washington University surgical video education" },
    ],
  },
  {
    title: "Adult Reconstruction",
    resources: [
      { name: "Hip and Knee Book", url: "https://hipandkneebook.com", description: "Free online textbook for joint replacement" },
    ],
  },
  {
    title: "Sports (Hip / Knee)",
    resources: [],
  },
  {
    title: "Foot / Ankle",
    resources: [],
  },
  {
    title: "Pediatrics",
    resources: [
      { name: "POSNA Academy", url: "https://www.posnacademy.org/", description: "Pediatric orthopaedic webinars and podcasts" },
      { name: "POSNA Study Guide", url: "https://posna.org/physician-education/study-guide", description: "Pediatric orthopaedic study resources" },
    ],
  },
  {
    title: "Oncology",
    resources: [
      { name: "James Wittig - MEDtube", url: "https://medtube.net/users/james-wittig", description: "Orthopedic oncology lecture videos" },
      { name: "TumorSurgery.org", url: "https://tumorsurgery.org/", description: "Orthopedic oncology resources from Dr. Wittig" },
    ],
  },
  {
    title: "Spine",
    resources: [
      { name: "The Spinepedia", url: "https://thespinepedia.com/", description: "Spine surgery educational resources" },
    ],
  },
  {
    title: "YouTube Channels",
    resources: [
      { name: "Dr. Vinay Kumar Singh", url: "https://www.youtube.com/@DrVinayKumarSingh", description: "Surgical videos and examinations" },
      { name: "Orthobullets", url: "https://www.youtube.com/@orthobullets", description: "Official Orthobullets video channel" },
      { name: "HSS", url: "https://hss.edu/orthopaedic-surgical-videos", description: "Hospital for Special Surgery surgical videos" },
      { name: "Husky Orthopedics", url: "https://www.youtube.com/user/HuskyOrthopaedics", description: "UW Orthopaedics & Sports Medicine" },
      { name: "NYU Ortho", url: "https://www.youtube.com/@NYULangoneHealth", description: "NYU Langone Health" },
      { name: "Pathognomonique", url: "https://www.youtube.com/@medamir", description: "Trauma and orthopedic education" },
      { name: "OrthoClips", url: "https://www.youtube.com/@OrthoClips", description: "Free education for orthopaedic residents" },
      { name: "Just Ortho Things!", url: "https://www.youtube.com/@Justorthothings", description: "Orthopedic surgery content" },
      { name: "ASES", url: "https://www.youtube.com/@AmericanShoulderElbowSurgeons", description: "American Shoulder and Elbow Surgeons" },
      { name: "Anthony Romeo", url: "https://www.youtube.com/@AnthonyRomeoMD", description: "Shoulder surgical techniques" },
      { name: "Arthroscopy Techniques", url: "https://www.youtube.com/@ArthroscopyTechniques", description: "Arthroscopic surgical technique videos" },
      { name: "Thomas McClellan", url: "https://www.youtube.com/@DrThomasMcClellan", description: "Hand and plastic surgery videos" },
      { name: "Wash U St. Louis", url: "https://www.youtube.com/@WashUSurgicalEducation", description: "Washington University surgical education" },
      { name: "Arthrex", url: "https://www.youtube.com/@Arthrex", description: "Surgical techniques and animations" },
      { name: "Seattle Science Foundation", url: "https://www.youtube.com/@SeattleScienceFoundation", description: "Spine surgery education and research" },
    ],
  },
];

export default function ResourcesPage() {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(LEARNING_RESOURCES.map((c) => c.title))
  );

  const toggleCategory = (title: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Learning Resources</h1>
        <p className="text-muted-foreground">
          Curated educational resources for orthopedic residents and surgeons
        </p>
      </div>

      <div className="space-y-4">
        {LEARNING_RESOURCES.map((category) => {
          const isExpanded = expandedCategories.has(category.title);

          return (
            <Card key={category.title}>
              <CardHeader
                className="cursor-pointer select-none"
                onClick={() => toggleCategory(category.title)}
              >
                <CardTitle className="flex items-center justify-between text-lg">
                  <span>{category.title}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-normal text-muted-foreground">
                      {category.resources.length} resources
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5" />
                    ) : (
                      <ChevronRight className="h-5 w-5" />
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              {isExpanded && (
                <CardContent>
                  {category.resources.length > 0 ? (
                    <ul className="space-y-3">
                      {category.resources.map((resource) => (
                        <li key={resource.url}>
                          <a
                            href={resource.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start gap-2 p-2 rounded-md hover:bg-accent transition-colors group"
                          >
                            <ExternalLink className="h-4 w-4 mt-1 flex-shrink-0 text-muted-foreground group-hover:text-primary" />
                            <div>
                              <span className="font-medium group-hover:text-primary">
                                {resource.name}
                              </span>
                              {resource.description && (
                                <p className="text-sm text-muted-foreground">
                                  {resource.description}
                                </p>
                              )}
                            </div>
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No resources yet. Coming soon!
                    </p>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
