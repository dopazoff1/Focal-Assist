package com.focal.api.dto;

public class KbValidationCommentRequestDto {
    private String selector;
    private String selectedText;
    private String comment;

    public String getSelector() { return selector; }
    public void setSelector(String selector) { this.selector = selector; }
    public String getSelectedText() { return selectedText; }
    public void setSelectedText(String selectedText) { this.selectedText = selectedText; }
    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
}
