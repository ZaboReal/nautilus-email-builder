/**
 * React Email primitives — the *canonical* render path.
 *
 * These are used by EmailDocument, which is fed through
 * @react-email/render to produce inbox-ready HTML for both the live
 * preview iframe and the Resend send. They are NOT mounted directly in
 * the browser DOM (that's what `puckRenderers.tsx` is for).
 */

import {
  Button as REButton,
  Container as REContainer,
  Heading as REHeading,
  Img as REImg,
  Section as RESection,
  Text as REText,
} from "@react-email/components";
import type { ReactNode } from "react";
import type {
  ButtonProps,
  ContainerProps,
  HeadingProps,
  ImageProps,
  SectionProps,
  TextProps,
} from "./schema";

export function HeadingEmail(props: HeadingProps) {
  const tag = (`h${props.level}` as "h1" | "h2" | "h3");
  return (
    <REHeading
      as={tag}
      style={{
        color: props.color,
        fontSize: props.fontSize,
        fontWeight: Number(props.fontWeight),
        textAlign: props.align,
        margin: `${props.marginTop} 0 ${props.marginBottom} 0`,
        lineHeight: 1.2,
      }}
    >
      {props.text}
    </REHeading>
  );
}

export function TextEmail(props: TextProps) {
  return (
    <REText
      style={{
        color: props.color,
        fontSize: props.fontSize,
        lineHeight: props.lineHeight,
        textAlign: props.align,
        margin: `${props.marginTop} 0 ${props.marginBottom} 0`,
      }}
    >
      {props.text}
    </REText>
  );
}

export function ButtonEmail(props: ButtonProps) {
  return (
    <RESection style={{ textAlign: props.align, margin: "8px 0" }}>
      <REButton
        href={props.href || "#"}
        style={{
          backgroundColor: props.bgColor,
          color: props.color,
          fontSize: props.fontSize,
          fontWeight: Number(props.fontWeight),
          padding: `${props.paddingY} ${props.paddingX}`,
          borderRadius: props.borderRadius,
          textDecoration: "none",
          display: "inline-block",
        }}
      >
        {props.label}
      </REButton>
    </RESection>
  );
}

export function ImageEmail(props: ImageProps) {
  const margin =
    props.align === "center"
      ? "0 auto"
      : props.align === "right"
        ? "0 0 0 auto"
        : "0";
  return (
    <RESection style={{ textAlign: props.align }}>
      <REImg
        src={props.src}
        alt={props.alt}
        width={props.width}
        style={{
          display: "block",
          maxWidth: "100%",
          margin,
          borderRadius: props.borderRadius,
        }}
      />
    </RESection>
  );
}

export function ContainerEmail(props: ContainerProps & { children?: ReactNode }) {
  return (
    <REContainer
      style={{
        backgroundColor: props.backgroundColor,
        padding: `${props.paddingY} ${props.paddingX}`,
        maxWidth: props.maxWidth,
        borderRadius: props.borderRadius,
        margin: "0 auto",
      }}
    >
      {props.children}
    </REContainer>
  );
}

export function SectionEmail(props: SectionProps & { children?: ReactNode }) {
  return (
    <RESection
      style={{
        backgroundColor: props.backgroundColor,
        padding: `${props.paddingY} ${props.paddingX}`,
        textAlign: props.align,
      }}
    >
      {props.children}
    </RESection>
  );
}

export const emailPrimitives = {
  Heading: HeadingEmail,
  Text: TextEmail,
  Button: ButtonEmail,
  Image: ImageEmail,
  Container: ContainerEmail,
  Section: SectionEmail,
} as const;
