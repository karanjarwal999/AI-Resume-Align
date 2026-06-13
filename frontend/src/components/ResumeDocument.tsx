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
  name: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
    color: "#0f172a",
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#e4e4e7",
    marginBottom: 12,
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
});

type Props = {
  result: CustomizedResume;
};

export function ResumeDocument({ result }: Props) {
  const displayName = result.name.trim() || "Resume";
  return (
    <Document title={`${displayName} — Resume`}>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.name}>{displayName}</Text>
        <View style={styles.divider} />

        <Text style={styles.sectionHeading}>Summary</Text>
        <Text style={styles.paragraph}>{result.summary}</Text>

        <Text style={styles.sectionHeading}>Experience</Text>
        {result.experience.map((bullet, i) => (
          <View key={i} style={styles.bulletRow}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>{bullet}</Text>
          </View>
        ))}

        <Text style={styles.sectionHeading}>Education</Text>
        {result.education.map((entry, i) => (
          <View key={i} style={styles.bulletRow}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>{entry}</Text>
          </View>
        ))}

        <Text style={styles.sectionHeading}>Skills</Text>
        <View style={styles.skillsRow}>
          {result.skills.map((skill, i) => (
            <Text key={i} style={styles.skillChip}>
              {skill}
            </Text>
          ))}
        </View>
      </Page>
    </Document>
  );
}
