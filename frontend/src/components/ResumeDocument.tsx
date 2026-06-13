"use client";

import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import type { CustomizedResume } from "@/lib/types";

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontSize: 10.5,
    lineHeight: 1.45,
    fontFamily: "Helvetica",
    color: "#1f2937",
  },
  title: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    marginBottom: 14,
    color: "#0f172a",
  },
  sectionHeading: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#52525b",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 14,
    marginBottom: 6,
  },
  paragraph: {
    marginBottom: 4,
  },
  skillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  skillChip: {
    backgroundColor: "#f4f4f5",
    color: "#27272a",
    fontSize: 9,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 8,
    marginRight: 5,
    marginBottom: 5,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  bullet: {
    width: 10,
    textAlign: "center",
  },
  bulletText: {
    flex: 1,
  },
  suggestedBox: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#fcd34d",
    backgroundColor: "#fffbeb",
    padding: 10,
    borderRadius: 4,
  },
  suggestedHeading: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#92400e",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  suggestedNote: {
    fontSize: 8.5,
    color: "#a16207",
    marginBottom: 6,
  },
  suggestedItem: {
    fontSize: 10,
    color: "#78350f",
    marginBottom: 2,
  },
});

type Props = {
  result: CustomizedResume;
};

export function ResumeDocument({ result }: Props) {
  return (
    <Document title="Customized Resume">
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>Customized Resume</Text>

        <Text style={styles.sectionHeading}>Summary</Text>
        <Text style={styles.paragraph}>{result.summary}</Text>

        <Text style={styles.sectionHeading}>Skills</Text>
        <View style={styles.skillsRow}>
          {result.skills.map((skill, i) => (
            <Text key={i} style={styles.skillChip}>
              {skill}
            </Text>
          ))}
        </View>

        <Text style={styles.sectionHeading}>Experience</Text>
        {result.experience.map((bullet, i) => (
          <View key={i} style={styles.bulletRow}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>{bullet}</Text>
          </View>
        ))}

        {result.suggested_additions.length > 0 && (
          <View style={styles.suggestedBox}>
            <Text style={styles.suggestedHeading}>Suggested additions</Text>
            <Text style={styles.suggestedNote}>
              These appeared in the JD but not in your resume. Advisory only;
              not part of the resume body.
            </Text>
            {result.suggested_additions.map((addition, i) => (
              <Text key={i} style={styles.suggestedItem}>
                • {addition}
              </Text>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}
