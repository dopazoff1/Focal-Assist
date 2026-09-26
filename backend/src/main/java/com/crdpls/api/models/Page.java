package com.crdpls.api.models;

import jakarta.persistence.*;
import java.util.List;

@Entity
@Table(name = "pages")
public class Page {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    @Lob
    @Column(columnDefinition = "LONGTEXT")
    private String content;

    private String tag;

    @Column(name = "prev_page_id")
    private Long prevPageId;

    @Column(name = "is_start")
    private Boolean isStart;

    @Transient
    private List<Choice> choices;

    // Getters & Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getTag() { return tag; }
    public void setTag(String tag) { this.tag = tag; }

    public Long getPrevPageId() { return prevPageId; }
    public void setPrevPageId(Long prevPageId) { this.prevPageId = prevPageId; }

    public Boolean getIsStart() { return isStart; }
    public void setIsStart(Boolean isStart) { this.isStart = isStart; }

    public List<Choice> getChoices() { return choices; }
    public void setChoices(List<Choice> choices) { this.choices = choices; }
}
