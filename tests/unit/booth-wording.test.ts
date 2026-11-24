// 부스 화면 낱말 바꾸기: "녹취" → "음성 기록"(조사도 받침에 맞게), "시연" → "수업"
import { describe, expect, it } from "vitest";
import { boothWording } from "@/server/booth";

describe("부스 화면 낱말", () => {
  it("녹취 뒤 조사를 받침에 맞게 바꾼다", () => {
    expect(boothWording("녹취와 대조")).toBe("음성 기록과 대조");
    expect(boothWording("녹취를 보고")).toBe("음성 기록을 보고");
    expect(boothWording("녹취는 짧다")).toBe("음성 기록은 짧다");
    expect(boothWording("녹취가 없다")).toBe("음성 기록이 없다");
    expect(boothWording("녹취로 확인")).toBe("음성 기록으로 확인");
    expect(boothWording("녹취에서 확인")).toBe("음성 기록에서 확인");
  });
  it("시연은 수업으로, 겹치거나 어색한 말은 따로", () => {
    expect(boothWording("3분 부스 체험 수업 시연")).toBe("3분 부스 체험 수업");
    expect(boothWording("시연 강사")).toBe("담당 강사");
    expect(boothWording("다음 시연에서는")).toBe("다음 수업에서는");
    expect(boothWording("말·쓰기·시연 등 다양한 참여 방식")).toBe("말·쓰기·발표 등 다양한 참여 방식");
  });
});
