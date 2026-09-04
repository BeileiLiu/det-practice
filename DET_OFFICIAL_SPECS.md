# DET 题型官方出题规格（提取自 Technical Manual 2026）

> 来源：Duolingo English Test Technical Manual (July 2, 2026)
> PDF：https://duolingo-papers.s3.us-east-1.amazonaws.com/other/technical_manual/DET_technical_manual_2026_07.pdf
> 评分标准：http://go.duolingo.com/DET_speaking_and_writing_rubrics

---

## 一、考试结构总览（Table 2）

### Focus Area 1: Linguistic Resources（语言资源，先考）

| 题型 | 考生看到的名称 | 是否自适应 | 数量 | 每题时间 |
|---|---|---|---|---|
| Yes/No Vocabulary | Read and Select | 是 | 15-18 题 | 5 秒 |
| Vocabulary in Context | Fill in the Blanks | 是 | 6-9 题 | 20 秒 |
| C-test | Read and Complete | 是 | 3-6 段 | 3 分钟/段 |
| Dictation | Listen and Type | 是 | 6-9 题 | 1 分钟/题 |

### Focus Area 2: Skills Mastery（技能掌握，后考）

| 题型 | 考生看到的名称 | 是否自适应 | 数量 | 每题时间 |
|---|---|---|---|---|
| Interactive Reading | Interactive Reading | 是 | 2-3 段 | 7-8 分钟/段 |
| Interactive Listening | Interactive Listening | 是 | 2-3 段 | 7分45秒/段 |
| Picture Description (Writing) | Write About the Photo | 否 | 3 题 | 1 分钟/题 |
| Interactive Writing | Interactive Writing | 否 | 1 题 | 8 分钟 |
| Picture Description (Speaking) | Speak About the Photo | 否 | 1 题 | 1分30秒 |
| Extended Speaking | Read, Then Speak | 否 | 1 题 | 1分30秒 |
| Interactive Speaking | Interactive Speaking | 是 | 1 题 | 3分45秒 |
| Writing Sample | Writing Sample | 否 | 1 题 | 5 分钟 |
| Speaking Sample | Speaking Sample | 否 | 1 题 | 3 分钟 |

### 评分维度（Table 3: Speaking & Writing Subconstructs）

| 维度 | 评估内容 | 自动评分示例特征 |
|---|---|---|
| **Content** | 任务完成度、相关性、风格适当性、发展性 | prompt embedding 与 response embedding 的余弦相似度 |
| **Discourse coherence** | 清晰度、连贯性、观点推进、格式适当性、结构（仅写作） | 语言模型预测的连贯性评分（0-6） |
| **Lexis** | 词汇多样性、词汇复杂度、用词、拼写（仅写作） | C1 及以上词占响应词数的比例 |
| **Grammar** | 结构范围、语法复杂度、错误频率、错误严重度 | 句法依存树平均深度 |
| **Fluency（仅口语）** | 语速、语块、中断、修补 | 每秒词数 |
| **Pronunciation（仅口语）** | 可理解性、可辨识度、单词重音、节奏、语调、连读 | 端到端神经发音评分 |

---

## 二、各题型详细规格

### 1. Yes/No Vocabulary（Read and Select）

**做什么：** 逐个展示一个英文单词或伪词，判断是不是真词。每次一个词，选 Yes 或 No。
**时间：** 每词 5 秒
**数量：** 15-18 词
**自适应：** 是——根据前面表现调整难度
**出题规则：**
- 伪词用 LSTM 循环神经网络生成，看起来像英文但不是真词
- 过滤掉任何与真词在拼写或发音上过于接近的伪词
- 测试词汇广度（breadth of receptive vocabulary knowledge）
- 需要掌握拼写规则和词形知识才能快速区分

---

### 2. Vocabulary in Context（Fill in the Blanks）

**做什么：** 展示一个句子，其中一个词被部分删除（给出前半部分，后半部分为空白），根据上下文补全单词。每个空白用下划线表示字符数。
**时间：** 每题 20 秒
**数量：** 6-9 题
**自适应：** 是
**出题规则：**
- 目标词来自大型英语语料库，覆盖四种词性：形容词、副词、名词、动词
- 句子反映五种文体：文学、教科书、新闻、个人写作、对话
- 空白部分用下划线提示单词长度
- 每位考生至少遇到一道含同义词或反义词线索的题
- 每位考生至少遇到一道含搭配线索的题
- 测试词汇深度（depth）和流利度（fluency）

---

### 3. C-test（Read and Complete）

**做什么：** 展示一段短文。第一句和最后一句完整保留，中间句子的每隔一个词被"损坏"（删除单词的后半部分）。考生需要根据上下文和语篇信息补全这些残缺词。
**时间：** 每段 3 分钟
**数量：** 3-6 段
**自适应：** 是
**出题规则：**
- 段落反映不同文体：小说/口语叙事、新闻文章、教科书段落
- 涵盖教育、职业、公共、私人四个语言使用领域
- 残缺词既包括实词也包括虚词，覆盖多种词性
- 超过 150 个语言特征被标注和考量，包括词性、动词类型、段落长度
- 测试全局语言能力，主要评估词汇和语法知识
- 与阅读、拼写、词汇能力中等相关

---

### 4. Dictation（Listen and Type）

**做什么：** 听一个句子或短段落，用键盘转录听到的内容。可以播放最多 3 次。
**时间：** 每题 1 分钟（含播放时间）
**数量：** 6-9 题
**自适应：** 是
**出题规则：**
- 语言功能包括：请求信息、表达观点、陈述事实
- 包含真实语言特征：缩写（contractions）、省音（elisions）
- 在时间和重播次数限制下，需要理解词汇和语法才能无错完成
- 测试听觉词汇识别和拼写再现能力

---

### 5. Interactive Reading

**做什么：** 一篇长文，分 5 个子题依次完成，都在同一篇文章上操作：

**子题1 — Complete the Sentences（补全句子）：**
- 展示文章前半部分，挖掉 3-10 个词
- 从选项中选择最佳词填入每个空

**子题2 — Complete the Passage（补全段落）：**
- 展示文章后半部分，缺少一个句子
- 从多个选项中选择最佳句子补全文章

**子题3 — Highlight the Answer（高亮答案）：**
- 两个问题，要求考生在文本中高亮包含答案的部分

**子题4 — Identify the Idea（识别观点）：**
- 选择文中出现的一个观点（多选一）

**子题5 — Title the Passage（给段落加标题）：**
- 从多个选项中选择最佳标题

**时间：** 一段 7-8 分钟（7分钟和8分钟各一段）
**数量：** 2-3 段（一段叙事文 + 一段说明文）
**自适应：** 是
**出题规则：**
- 每段分类为叙事文（narrative）或说明文（expository）
- 每位考生收到一篇叙事 + 一篇说明
- 两段的补全句子空数总量大致相同
- 覆盖教育和职业领域的多种话题
- 用 GPT-3/LLM 生成文章和选项（Attali et al., 2022）

---

### 6. Interactive Listening

**做什么：** 模拟大学场景对话，分 3 个子题：

**子题1 — Scenario Comprehension（场景理解）：**
- 听一段场景描述（对话对象和目的）
- 回答 3-4 个填空理解题

**子题2 — Dialogue Completion（对话补全）：**
- 听对话的每一回合（音频），选择最佳书面回复继续对话
- 每个回复后即时反馈（绿色勾/红色叉 + 正确答案）
- 有些要求选对话的第一句，有些从对方开始

**子题3 — Summarization（总结）：**
- 75 秒内书面总结对话要点
- 这是一个综合写作任务（听 + 写）

**时间：** 整段 7 分 45 秒
**数量：** 2-3 段（一段学生-学生 + 一段学生-教授）
**自适应：** 是
**出题规则：**
- 三种对话类型：学生-学生（请求、建议等）、学生-教授（类似目的）、学生-教授（信息查询）
- 场景设定在英语授课的大学环境
- 交际功能包括：请求澄清讲座内容、提出请求、收集信息、寻求建议、安排学习小组
- 完成对话子题的选择是根据考生之前的表现动态选取的

---

### 7. Picture Description — Writing（Write About the Photo）

**做什么：** 看一张照片，60 秒内用文字描述。
**时间：** 60 秒
**数量：** 3 题
**自适应：** 否
**出题规则：**
- 图片由应用语言学高级学位持有者挑选
- 包含人物、动物、物体的多种场景
- 设计为能激发从初级到高级各水平考生展示语言能力
- 评估维度：Content, Discourse coherence, Grammar, Vocabulary

---

### 8. Picture Description — Speaking（Speak About the Photo）

**做什么：** 看一张照片，90 秒内口头描述。
**时间：** 90 秒
**数量：** 1 题
**自适应：** 否
**出题规则：**
- 与写作版相同类型的图片
- 评估维度：Content, Discourse coherence, Grammar, Vocabulary, Fluency, Pronunciation
- 图片包含人物、动物、物体的多种场景，让各水平考生都能展示词汇和语法能力

---

### 9. Extended Speaking（Read, Then Speak）

**做什么：** 读一个书面提示，90 秒内口头回答。提示要求叙述经历或论证观点。
**时间：** 90 秒
**数量：** 1 题
**自适应：** 否
**出题规则：**
- 提示要求叙述（narrative）或论证/说服（argumentative/persuasive）
- 话题覆盖 CEFR 四个领域：个人、公共、教育、职业
- 评估维度：Content, Discourse coherence, Grammar, Vocabulary, Fluency, Pronunciation

---

### 10. Speaking Sample

**做什么：** 读一个书面提示，3 分钟内口头回答。
**时间：** 3 分钟
**数量：** 1 题
**自适应：** 否
**出题规则：**
- 同 Extended Speaking，但时间更长、要求更深入
- 口头回答的录音会随成绩报告发送给考生选择的机构

---

### 11. Interactive Writing

**做什么：** 两段式写作任务。
- **第一部分：** 读提示，5 分钟内书面回答（叙述经历或论证观点）
- **第二部分：** AI 实时分析第一部分的主题，生成一个相关的追问；考生 3 分钟内书面回答追问

**时间：** 5 + 3 = 8 分钟
**数量：** 1 题
**自适应：** 否
**出题规则：**
- 追问基于考生自己写的内容生成，要求进一步阐述
- 更真实地反映现实写作场景
- 评估维度：Content, Discourse coherence, Grammar, Vocabulary

---

### 12. Writing Sample

**做什么：** 读一个书面提示，5 分钟内书面回答。
**时间：** 5 分钟
**数量：** 1 题
**自适应：** 否
**出题规则：**
- 提示要求叙述经历或论证观点
- 书面回答会随成绩报告发送给考生选择的机构
- 评估维度：Content, Discourse coherence, Grammar, Vocabulary

---

### 13. Interactive Speaking

**做什么：** 与屏幕上的虚拟角色进行主题对话。通常 2 个话题，每个话题 3-4 轮问答。每轮听到提示后 35 秒内口头回答。
**时间：** 整段 3 分 45 秒
**数量：** 1 题
**自适应：** 是——后续问题根据考生之前的回答动态选取
**出题规则：**
- 模拟真实世界的口语交际功能：叙述、描述、解释、表达观点
- 考生不需要主动发起话题或提问
- 使用结构化的问答相邻对（adjacency pairs）格式
- 评估维度：Content, Discourse coherence, Grammar, Vocabulary, Fluency, Pronunciation
- 额外评估任务完成度（task completion）——是否涵盖了关键内容点

---

## 三、CAT 自适应算法

1. 考试从 Yes/No Vocabulary 开始，然后是 Vocabulary in Context
2. 根据考生对初始题目的回答，做出临时能力估计 θ̂ₜ
3. 下一题的难度 bₜ₊₁ = f(θ̂ₜ)
4. 每答一题更新一次能力估计（Expected A Posteriori 估计）
5. 持续直到满足停止条件（超过最大时间/题数，且已满足最少题数）
6. 大部分考生在一小时内完成

**Item Response Theory (IRT) 参数：**
- 难度（difficulty）和区分度（discrimination）
- 新题用 SPICE 工具预测参数（基于词汇特征的模型）
- 收集足够数据后用实际答题数据重新校准

---

## 四、AI 题目生成流程（Item Factory）

1. 每种题型有专门的 prompt，由 AI 工程师和评估科学家协作迭代优化
2. 可以短时间内生成数百甚至数千道题
3. 自动检查：语言准确性、社会适当性、偏见/歧视检测
4. 人工审核（IQR）：英语写作规范、发音准确性、事实核查
5. 公平与偏见审核（FAB）：两位或三位审核员按内部 FAB 准则评估
6. 最终入题库前经过试点测试和心理测量分析
