// --- POS-to-ERP Integration Hub Visualizer Logic ---

// 1. Data Definitions for Weekly roadmap
const weekData = {
    1: {
        title: "Giai đoạn 1: Khởi tạo dự án & Trục API luồng bán hàng (Inbound POS API)",
        tech: "Spring Boot 3.x, Spring Data JPA, PostgreSQL, Postman",
        badge: "Inbound POS API",
        highlights: {
            nodes: ["node-pos", "node-inbound-api", "node-postgres"],
            paths: ["path-pos-inbound-active"],
            tables: ["table-orders", "table-order-items"]
        },
        description: `
            <h4>Mục tiêu cốt lõi:</h4>
            <p>Xây dựng hệ tiếp nhận dữ liệu giao dịch thời gian thực từ các máy POS tại cửa hàng bắn về khi có giao dịch thành công.</p>
            <ul>
                <li><strong>Bước 1.1: Khởi tạo Project</strong> - Cài đặt Spring Boot 3.x với Spring Web, JPA, PostgreSQL Driver và Lombok.</li>
                <li><strong>Bước 1.2: Thiết kế Database</strong> - Cấu hình 2 bảng chính: <code>orders</code> và <code>order_items</code>.</li>
                <li><strong>Bước 1.3: Viết REST API Endpoint</strong> - Tạo <code>@RestController</code> đón POST tại <code>/api/v1/pos/orders</code> nhận Payload JSON chuẩn hóa.</li>
                <li><strong>Bước 1.4: Mock Test</strong> - Dùng Postman giả lập máy POS đẩy dữ liệu để kiểm tra tính toàn vẹn cơ sở dữ liệu.</li>
            </ul>
        `,
        code: `// 1. DTO nhận dữ liệu từ POS
public record OrderPayload(
    String posMachineId,
    BigDecimal totalAmount,
    BigDecimal discount,
    BigDecimal tax,
    List<ItemPayload> items
) {}

// 2. Controller tiếp nhận đơn hàng
@RestController
@RequestMapping("/api/v1/pos")
@RequiredArgsConstructor
public class PosInboundController {
    private final OrderService orderService;

    @PostMapping("/orders")
    public ResponseEntity<OrderResponse> receiveOrder(@RequestBody OrderPayload payload) {
        OrderResponse response = orderService.processInboundOrder(payload);
        return ResponseEntity.ok(response);
    }
}

// 3. Database Schema (PostgreSQL)
CREATE TABLE orders (
    id UUID PRIMARY KEY,
    pos_machine_id VARCHAR(50) NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    discount DECIMAL(12,2) DEFAULT 0,
    tax DECIMAL(12,2) DEFAULT 0,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL
);`
    },
    2: {
        title: "Giai đoạn 2: Phát triển Module AI/OCR bóc tách Hóa đơn nhập hàng",
        tech: "Spring WebClient, Gemini API, JSON Schema, PG Staging Bảng",
        badge: "AI & OCR Extraction",
        highlights: {
            nodes: ["node-ocr-source", "node-ocr-module", "node-gemini-api", "node-postgres"],
            paths: ["path-ocr-upload-active", "path-ocr-gemini-active", "path-ocr-db-active"],
            tables: ["table-staging-invoices"]
        },
        description: `
            <h4>Mục tiêu cốt lõi:</h4>
            <p>Trích xuất hóa đơn nhập hàng tự động từ ảnh/PDF bằng AI, chuyển đổi thành dữ liệu JSON cấu trúc sạch thay vì dùng Regex truyền thống dễ lỗi.</p>
            <ul>
                <li><strong>Bước 2.1: Endpoint nhận File</strong> - API POST tại <code>/api/v1/invoices/upload</code> hỗ trợ nhận MultipartFile định dạng JPG, PNG, PDF.</li>
                <li><strong>Bước 2.2: Tích hợp API Vision / Gemini</strong> - Sử dụng <code>WebClient</code> kết nối Gemini API. Gửi Base64 của ảnh kèm Prompt định hình.</li>
                <li><strong>Bước 2.3: Áp dụng Ràng buộc Định dạng (Structured Outputs)</strong> - Cấu hình JSON Schema bắt buộc AI trả về đúng định dạng (Mã số thuế, Ngày lập, Item...).</li>
                <li><strong>Bước 2.4: Lưu trữ bảng tạm (Staging)</strong> - Đẩy dữ liệu thô đã bọc tách vào bảng <code>staging_invoices</code> để kế toán duyệt ở các bước sau.</li>
            </ul>
        `,
        code: `// Sử dụng Gemini API Structured Outputs qua Spring WebClient
public Map<String, Object> extractInvoiceData(byte[] fileBytes, String mimeType) {
    String base64Image = Base64.getEncoder().encodeToString(fileBytes);
    
    // Khởi tạo Request Body tuân theo cấu trúc JSON Schema mong muốn
    String requestJson = """
    {
      "contents": [{
        "parts": [
          {"text": "Bóc tách hóa đơn này và trả về JSON chuẩn theo cấu trúc yêu cầu."},
          {"inline_data": {"mime_type": "%s", "data": "%s"}}
        ]
      }],
      "generationConfig": {
        "responseMimeType": "application/json",
        "responseSchema": {
          "type": "OBJECT",
          "properties": {
            "vendorTaxCode": {"type": "STRING"},
            "invoiceDate": {"type": "STRING"},
            "totalAmount": {"type": "NUMBER"},
            "items": {
              "type": "ARRAY",
              "items": {
                "type": "OBJECT",
                "properties": {
                  "productName": {"type": "STRING"},
                  "quantity": {"type": "INTEGER"},
                  "unitPrice": {"type": "NUMBER"}
                }
              }
            }
          }
        }
      }
    }""".formatted(mimeType, base64Image);

    // Call API thông qua WebClient
    return webClient.post()
        .uri("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + geminiApiKey)
        .bodyValue(requestJson)
        .retrieve()
        .bodyToMono(Map.class)
        .block();
}`
    },
    3: {
        title: "Giai đoạn 3: Xây dựng Core Logic Hub & Tích hợp ERP Client",
        tech: "OpenFeign, HttpClient, Idempotency Engine, ERP APIs",
        badge: "Core Sync & ERP Integration",
        highlights: {
            nodes: ["node-core-logic", "node-postgres", "node-erp"],
            paths: ["path-inbound-core-active", "path-core-db-active", "path-core-erp-active"],
            tables: ["table-orders", "table-order-items", "table-staging-invoices"]
        },
        description: `
            <h4>Mục tiêu cốt lõi:</h4>
            <p>Biến Integration Hub thành "Trạm trung chuyển" logic chính, chịu trách nhiệm xử lý nghiệp vụ, đảm bảo đồng bộ dữ liệu chuẩn xác sang ERP.</p>
            <ul>
                <li><strong>Bước 3.1: Thiết lập ERP Client</strong> - Tạo các client chuyên biệt sử dụng Spring Cloud OpenFeign gọi API sang phía ERP.</li>
                <li><strong>Bước 3.2: Đồng bộ POS (Doanh thu)</strong> - Khi đơn hàng POS thanh toán thành công, Hub tự động kích hoạt tiến trình giảm tồn kho và ghi nhận doanh số trên ERP.</li>
                <li><strong>Bước 3.3: Đồng bộ OCR (Nhập kho)</strong> - Chuyển hóa đơn mua hàng đã duyệt thành lệnh tăng kho vật lý và ghi nhận Công nợ phải trả (Accounts Payable) trên ERP.</li>
                <li><strong>Bước 3.4: Xử lý chống trùng lặp (Idempotency)</strong> - Thiết lập cơ chế kiểm tra Idempotency Key tránh trường hợp POS lỗi mạng bắn trùng đơn hàng, làm sai lệch kế toán.</li>
            </ul>
        `,
        code: `// 1. Khai báo ERP Feign Client
@FeignClient(name = "erp-client", url = "\${erp.api.base-url}")
public interface ErpClient {
    
    @PostMapping("/api/v1/sales/order-sync")
    ResponseEntity<Void> syncSalesOrder(
        @RequestHeader("Idempotency-Key") String idempotencyKey,
        @RequestBody ErpOrderDto orderDto
    );

    @PostMapping("/api/v1/purchase/invoice-sync")
    ResponseEntity<Void> syncPurchaseInvoice(
        @RequestBody ErpInvoiceDto invoiceDto
    );
}

// 2. Kiểm tra Idempotency chống trùng lặp dữ liệu
@Service
@RequiredArgsConstructor
public class IdempotencyService {
    private final StringRedisTemplate redisTemplate;

    public boolean isUnique(String key) {
        // Lưu key trong 24 giờ, trả về true nếu key chưa từng tồn tại
        Boolean success = redisTemplate.opsForValue()
            .setIfAbsent("idemp:" + key, "PROCESSING", Duration.ofHours(24));
        return success != null && success;
    }
}`
    },
    4: {
        title: "Giai đoạn 4: Tối ưu hóa Hiệu năng hàng loạt với Spring Batch",
        tech: "Spring Batch, Chunk-oriented Processing, H2 Database (Metadata)",
        badge: "Spring Batch Engine",
        highlights: {
            nodes: ["node-spring-batch", "node-postgres", "node-h2", "node-erp"],
            paths: ["path-batch-db-active", "path-batch-h2-active", "path-batch-erp-active"],
            tables: ["table-orders", "table-order-items"]
        },
        description: `
            <h4>Mục tiêu cốt lõi:</h4>
            <p>Tối ưu hóa hiệu năng đối soát cuối ngày cho các chuỗi bán lẻ lớn với lượng dữ liệu khổng lồ (hàng chục ngàn bản ghi), tránh OutOfMemoryError.</p>
            <ul>
                <li><strong>Bước 4.1: Cấu hình Spring Batch</strong> - Thiết lập Job và Step theo mô hình Chunk-oriented (Reader đọc 100 dòng -> Processor xử lý nghiệp vụ -> Writer ghi hàng loạt sang ERP).</li>
                <li><strong>Bước 4.2: Tối ưu hóa Bộ nhớ (RAM)</strong> - Thay vì đọc tất cả bằng <code>findAll()</code>, sử dụng <code>RepositoryItemReader</code> để phân trang dữ liệu khi xử lý.</li>
                <li><strong>Bước 4.3: Lưu vết Tiến trình (Metadata Tables)</strong> - Dùng Database H2 làm bộ nhớ tạm lưu trữ metadata của Spring Batch để theo dõi trạng thái Job (STARTED, FAILED, COMPLETED) giúp có thể Resume lại Job từ vị trí lỗi khi gặp sự cố đột ngột.</li>
            </ul>
        `,
        code: `// Cấu hình Chunk-oriented Spring Batch Job
@Configuration
@EnableMethodSecurity
public class BatchJobConfig {

    @Bean
    public Job syncErpJob(JobRepository jobRepository, Step syncStep) {
        return new JobBuilder("pos-to-erp-sync-job", jobRepository)
            .start(syncStep)
            .build();
    }

    @Bean
    public Step syncStep(JobRepository jobRepository, PlatformTransactionManager transactionManager,
                        RepositoryItemReader<Order> reader,
                        ItemProcessor<Order, ErpOrderDto> processor,
                        ItemWriter<ErpOrderDto> writer) {
        return new StepBuilder("syncStep", jobRepository)
            .<Order, ErpOrderDto>chunk(100, transactionManager) // Chunk size: 100
            .reader(reader)
            .processor(processor)
            .writer(writer)
            .build();
    }

    @Bean
    public RepositoryItemReader<Order> reader(OrderRepository repository) {
        return new RepositoryItemReaderBuilder<Order>()
            .repository(repository)
            .methodName("findByStatus")
            .arguments(List.of("PENDING"))
            .pageSize(100) // Phân trang bộ nhớ tránh OOM
            .sorts(Map.of("id", Sort.Direction.ASC))
            .name("orderReader")
            .build();
    }
}`
    },
    5: {
        title: "Giai đoạn 5: Cơ chế Duyệt thủ công (Human-in-the-loop) & Hoàn thiện",
        tech: "Spring Security, Thymeleaf / React, SLF4J, Dead-Letter Queue",
        badge: "Human-in-the-loop & DLQ",
        highlights: {
            nodes: ["node-human-review", "node-dlq"],
            paths: ["path-ocr-review-active", "path-ocr-dlq-active"]
        },
        description: `
            <h4>Mục tiêu cốt lõi:</h4>
            <p>Hoàn thiện hệ thống bằng việc tích hợp giao diện duyệt thủ công dành cho kế toán xử lý các hóa đơn mờ hoặc lỗi bóc tách và cơ chế Dead-Letter Queue.</p>
            <ul>
                <li><strong>Bước 5.1: Xây dựng Giao diện Review</strong> - Màn hình Dashboard hiển thị song song ảnh gốc hóa đơn và biểu mẫu dữ liệu AI bóc tách được để kế toán chỉnh sửa.</li>
                <li><strong>Bước 5.2: Cảnh báo Độ tin cậy (Confidence Score)</strong> - Bôi đỏ các trường dữ liệu có độ tin cậy của AI dưới 90% nhằm thu hút sự chú ý của kế toán.</li>
                <li><strong>Bước 5.3: Quản lý File lỗi (Dead-Letter Queue)</strong> - Đẩy các tệp lỗi, không thể bọc tách sang thư mục cách ly <code>quarantine-zone</code> để lưu vết và tải lại tệp chất lượng cao hơn.</li>
            </ul>
        `,
        code: `// 1. Phân loại độ tin cậy và xử lý lỗi
@Service
@Slf4j
public class InvoiceProcessService {
    private static final double CONFIDENCE_THRESHOLD = 0.90;
    private final Path quarantineDirectory = Paths.get("quarantine-zone");

    public void processExtractedInvoice(StagingInvoice invoice) {
        if (invoice.getConfidenceScore() < CONFIDENCE_THRESHOLD) {
            log.warn("OCR Confidence too low ({}%) for Invoice ID: {}. Flags for human review.", 
                invoice.getConfidenceScore() * 100, invoice.getId());
            invoice.setStatus("PENDING_HUMAN_REVIEW");
            // Giao diện sẽ bôi đỏ các trường có điểm tin cậy thấp
        } else {
            invoice.setStatus("READY_TO_SYNC");
        }
    }

    public void routeToQuarantine(MultipartFile file, Exception ex) {
        log.error("Failed to parse invoice file. Moving to Dead-Letter Queue directory. Error: {}", ex.getMessage());
        try {
            Files.createDirectories(quarantineDirectory);
            String filename = "err_" + System.currentTimeMillis() + "_" + file.getOriginalFilename();
            Files.copy(file.getInputStream(), quarantineDirectory.resolve(filename));
        } catch (IOException e) {
            log.error("Failed to write to quarantine directory: {}", e.getMessage());
        }
    }
}`
    }
};

// State Variables
let currentWeek = 1;
let selectedNodeId = null;

const nodeFlowConnections = {
    "node-pos": {
        nodes: ["node-pos", "node-inbound-api", "node-core-logic", "node-postgres", "node-erp"],
        paths: ["path-pos-inbound-active", "path-inbound-core-active", "path-core-db-active", "path-core-erp-active"]
    },
    "node-ocr-source": {
        nodes: ["node-ocr-source", "node-ocr-module", "node-gemini-api", "node-postgres", "node-human-review", "node-dlq"],
        paths: ["path-ocr-upload-active", "path-ocr-gemini-active", "path-ocr-db-active", "path-ocr-review-active", "path-ocr-dlq-active"]
    },
    "node-ocr-module": {
        nodes: ["node-ocr-source", "node-ocr-module", "node-gemini-api", "node-postgres", "node-human-review", "node-dlq"],
        paths: ["path-ocr-upload-active", "path-ocr-gemini-active", "path-ocr-db-active", "path-ocr-review-active", "path-ocr-dlq-active"]
    },
    "node-gemini-api": {
        nodes: ["node-ocr-module", "node-gemini-api"],
        paths: ["path-ocr-gemini-active"]
    },
    "node-inbound-api": {
        nodes: ["node-pos", "node-inbound-api", "node-core-logic"],
        paths: ["path-pos-inbound-active", "path-inbound-core-active"]
    },
    "node-core-logic": {
        nodes: ["node-inbound-api", "node-core-logic", "node-postgres", "node-erp"],
        paths: ["path-inbound-core-active", "path-core-db-active", "path-core-erp-active"]
    },
    "node-spring-batch": {
        nodes: ["node-spring-batch", "node-postgres", "node-h2", "node-erp"],
        paths: ["path-batch-db-active", "path-batch-h2-active", "path-batch-erp-active"]
    },
    "node-human-review": {
        nodes: ["node-ocr-module", "node-human-review", "node-core-logic", "node-postgres", "node-erp"],
        paths: ["path-ocr-review-active", "path-inbound-core-active", "path-core-db-active", "path-core-erp-active"]
    },
    "node-dlq": {
        nodes: ["node-ocr-module", "node-dlq"],
        paths: ["path-ocr-dlq-active"]
    },
    "node-postgres": {
        nodes: ["node-postgres"],
        paths: []
    },
    "node-h2": {
        nodes: ["node-h2"],
        paths: []
    },
    "node-erp": {
        nodes: ["node-erp"],
        paths: []
    }
};

const consoleTimestamps = () => {
    const d = new Date();
    return d.toLocaleTimeString() + "." + String(d.getMilliseconds()).padStart(3, '0');
};

// 2. DOM Elements
document.addEventListener("DOMContentLoaded", () => {
    // Week selectors
    const weekButtons = document.querySelectorAll(".week-btn");
    
    // Tab switching for Week Info
    weekButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const week = parseInt(btn.getAttribute("data-week"));
            setActiveWeek(week);
        });
    });

    // Simulator Switcher
    const simTabs = document.querySelectorAll(".sim-tab");
    const simPanels = document.querySelectorAll(".sim-panel");
    simTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            simTabs.forEach(t => t.classList.remove("active"));
            simPanels.forEach(p => p.classList.remove("active"));
            
            tab.classList.add("active");
            const simId = tab.getAttribute("data-sim");
            document.getElementById(`sim-${simId}`).classList.add("active");
        });
    });

    // POS simulation triggers
    const btnTriggerPos = document.getElementById("btn-trigger-pos");
    btnTriggerPos.addEventListener("click", runPosSimulation);

    // OCR simulation triggers
    const btnMockGood = document.getElementById("btn-mock-invoice-good");
    const btnMockBlurry = document.getElementById("btn-mock-invoice-blurry");
    const btnOcrApprove = document.getElementById("btn-ocr-approve");
    const btnOcrReject = document.getElementById("btn-ocr-reject");

    btnMockGood.addEventListener("click", () => runOcrSimulation(true));
    btnMockBlurry.addEventListener("click", () => runOcrSimulation(false));
    btnOcrApprove.addEventListener("click", approveOcrInvoice);
    btnOcrReject.addEventListener("click", rejectOcrInvoice);

    // Batch simulation triggers
    const btnTriggerBatch = document.getElementById("btn-trigger-batch");
    btnTriggerBatch.addEventListener("click", runBatchSimulation);

    // Click node inside SVG to view direct flow
    const svgNodes = document.querySelectorAll(".node");
    svgNodes.forEach(node => {
        node.addEventListener("click", (e) => {
            e.stopPropagation();
            const nodeId = node.getAttribute("id");
            toggleNodeSelection(nodeId);
        });
    });

    // Click background of SVG to clear node selection
    const svgEl = document.getElementById("architecture-svg");
    svgEl.addEventListener("click", () => {
        if (selectedNodeId) {
            clearNodeSelection();
        }
    });

    // Initialize View
    setActiveWeek(1);
});

// 3. Set Active Week logic
function setActiveWeek(weekNum) {
    selectedNodeId = null; // Clear active node selection when switching weeks
    currentWeek = weekNum;
    
    // Update Sidebar Button UI
    document.querySelectorAll(".week-btn").forEach(btn => {
        btn.classList.remove("active");
        if (parseInt(btn.getAttribute("data-week")) === weekNum) {
            btn.classList.add("active");
        }
    });

    // Get active week metadata
    const data = weekData[weekNum];
    
    // Update labels
    document.getElementById("week-title-badge").innerText = `Tuần ${weekNum}`;
    document.getElementById("week-tech-badge").innerText = data.tech;
    document.getElementById("week-content-text").innerHTML = data.description;
    
    // Update Code Display
    const codeSnippet = document.getElementById("code-snippet");
    codeSnippet.textContent = data.code.trim();
    codeSnippet.className = weekNum === 1 ? "language-sql" : "language-java";
    
    // Update SVG highlights
    updateSvgHighlights(data.highlights);

    // Highlight database tables based on relevant schema changes in selected week
    document.querySelectorAll(".db-table").forEach(tbl => {
        tbl.classList.remove("active-highlight");
    });
    if (data.highlights.tables) {
        data.highlights.tables.forEach(tableId => {
            const el = document.getElementById(tableId);
            if (el) el.classList.add("active-highlight");
        });
    }
}

// 4. Update SVG Elements Highlights & Flow Lines
function updateSvgHighlights(highlights) {
    const svg = document.getElementById("architecture-svg");
    
    // Reset all nodes active status
    svg.querySelectorAll(".node").forEach(node => {
        node.classList.remove("active-highlight");
    });

    // Highlight active nodes for selected week
    highlights.nodes.forEach(nodeId => {
        const node = svg.getElementById(nodeId);
        if (node) {
            node.classList.add("active-highlight");
        }
    });

    // Reset boundary styling
    const hubBoundary = svg.querySelector(".hub-boundary");
    if (currentWeek >= 1 && currentWeek <= 5) {
        hubBoundary.classList.add("active-week");
    } else {
        hubBoundary.classList.remove("active-week");
    }

    // Manage Flow Lines visibility
    svg.querySelectorAll(".flow-line").forEach(line => {
        line.classList.remove("visible");
    });

    // Make paths visible for this week
    highlights.paths.forEach(pathId => {
        const path = svg.getElementById(pathId);
        if (path) {
            path.classList.add("visible");
        }
    });
}

// 5. Simulator 1: POS Inbound Flow
function runPosSimulation() {
    const machineId = document.getElementById("pos-machine-id").value || "POS_MCH_049";
    const productSelect = document.getElementById("pos-product");
    const productName = productSelect.options[productSelect.selectedIndex].text.split(" (")[0];
    const qty = parseInt(document.getElementById("pos-qty").value) || 1;
    const unitPrice = parseFloat(productSelect.options[productSelect.selectedIndex].getAttribute("data-price"));
    const rawTotal = unitPrice * qty;
    const discount = rawTotal * 0.05; // 5% discount
    const tax = (rawTotal - discount) * 0.1; // 10% tax
    const finalAmount = rawTotal - discount + tax;

    const logBox = document.getElementById("pos-logs");
    logBox.innerHTML = ""; // Clear log
    
    // Highlight SVG for POS transmission flow
    const svg = document.getElementById("architecture-svg");
    // Temporarily trigger active paths for live flow
    const flowPaths = ["path-pos-inbound-active", "path-inbound-core-active", "path-core-db-active", "path-core-erp-active"];
    const flowNodes = ["node-pos", "node-inbound-api", "node-core-logic", "node-postgres", "node-erp"];
    
    flowPaths.forEach(p => {
        const el = svg.getElementById(p);
        if (el) el.classList.add("visible");
    });
    flowNodes.forEach(n => {
        const el = svg.getElementById(n);
        if (el) el.classList.add("active-highlight");
    });

    writePosLog("INFO", "c.p.controller.PosInboundController", `Tiếp nhận request POS: POST /api/v1/pos/orders từ máy ${machineId}`);
    
    setTimeout(() => {
        writePosLog("INFO", "c.p.service.IdempotencyEngine", `Bắt đầu kiểm duyệt chống trùng lắp cho payload với Idempotency-Key: idemp-txn-${Date.now()}`);
    }, 400);

    setTimeout(() => {
        writePosLog("INFO", "c.p.service.IdempotencyEngine", `Trùng lặp: KHÔNG. Giao dịch hợp lệ. Chuyển tiếp luồng xử lý đơn hàng.`);
    }, 700);

    setTimeout(() => {
        writePosLog("INFO", "c.p.repository.OrderRepository", `SQL: INSERT INTO orders (id, pos_machine_id, total_amount, discount, tax, status, created_at) VALUES ('${uuidv4().substring(0, 8)}...', '${machineId}', ${finalAmount}, ${discount}, ${tax}, 'PAID', NOW())`);
        writePosLog("INFO", "c.p.repository.OrderRepository", `SQL: INSERT INTO order_items (id, order_id, product_code, quantity, unit_price) VALUES ('${uuidv4().substring(0, 8)}...', '...', '${productSelect.value}', ${qty}, ${unitPrice})`);
    }, 1100);

    setTimeout(() => {
        writePosLog("INFO", "c.p.client.ErpSyncClient", `Khởi tạo tiến trình đồng bộ sang ERP qua Feign Client: POST /api/v1/sales/order-sync`);
        writePosLog("INFO", "c.p.client.ErpSyncClient", `Payload ERP: DTO { machine: "${machineId}", product: "${productSelect.value}", quantity: ${qty}, syncRevenue: ${finalAmount} }`);
    }, 1600);

    setTimeout(() => {
        writePosLog("SUCCESS", "c.p.client.ErpSyncClient", `ERP Phản hồi: HTTP 200 SUCCESS - Đồng bộ bán hàng thành công, tồn kho kho hàng ERP giảm ${qty} đơn vị.`);
    }, 2200);

    setTimeout(() => {
        writePosLog("SUCCESS", "c.p.controller.PosInboundController", `Giao dịch hoàn tất. Trả về response Client: HTTP 200 OK | Transaction ID: TXN-${Math.floor(Math.random() * 90000 + 10000)} (Response time: 18ms)`);
        
        // Remove temporarily flows if not in Week 3
        if (currentWeek !== 3) {
            setTimeout(() => {
                resetSvgFlowsAfterSim();
            }, 1000);
        }
    }, 2500);
}

function writePosLog(level, category, message) {
    const logBox = document.getElementById("pos-logs");
    const line = document.createElement("div");
    line.className = `log-line ${level.toLowerCase()}`;
    line.innerHTML = `<span class="timestamp">${consoleTimestamps()}</span> <span class="log-level">[${level}]</span> <span class="log-cat">${category}</span> : ${message}`;
    logBox.appendChild(line);
    logBox.scrollTop = logBox.scrollHeight;
}

// 6. Simulator 2: AI OCR Invoice
let currentSimulatedInvoiceData = null;

function runOcrSimulation(isGood) {
    const dropZone = document.getElementById("ocr-drop-zone");
    const reviewContainer = document.getElementById("ocr-review-container");
    const logBox = document.getElementById("ocr-logs");
    
    logBox.innerHTML = ""; // Clear logs
    reviewContainer.classList.add("hidden");
    
    // Show Scan Overlay
    const overlay = document.createElement("div");
    overlay.className = "ocr-scan-overlay";
    overlay.innerHTML = `<div class="ocr-laser-line"></div><i class="fa-solid fa-robot pulse" style="font-size:2rem;margin-right:10px;"></i> Đang phân tích bằng Gemini AI...`;
    dropZone.appendChild(overlay);

    // Highlight SVG OCR flow
    const svg = document.getElementById("architecture-svg");
    const flowPaths = ["path-ocr-upload-active", "path-ocr-gemini-active", "path-ocr-review-active"];
    const flowNodes = ["node-ocr-source", "node-ocr-module", "node-gemini-api", "node-human-review"];
    
    flowPaths.forEach(p => {
        const el = svg.getElementById(p);
        if (el) el.classList.add("visible");
    });
    flowNodes.forEach(n => {
        const el = svg.getElementById(n);
        if (el) el.classList.add("active-highlight");
    });

    writeOcrLog("INFO", "c.p.c.InvoiceUploadController", `Tải lên file: hóa_đơn_nhập_kho_sô_${isGood ? '9812' : '0489'}.pdf (Size: 142KB)`);
    
    setTimeout(() => {
        writeOcrLog("INFO", "c.p.service.OcrVisionService", `Chuyển đổi dữ liệu PDF sang Base64 và thiết lập payload JSON Schema...`);
    }, 500);

    setTimeout(() => {
        writeOcrLog("INFO", "c.p.service.OcrVisionService", `Gửi yêu cầu nhận diện đến Gemini API (Model: gemini-1.5-flash)...`);
    }, 1000);

    setTimeout(() => {
        // Complete Scan
        overlay.remove();
        reviewContainer.classList.remove("hidden");
        
        const paper = document.getElementById("invoice-paper-preview");
        paper.className = "mock-invoice-paper" + (isGood ? "" : " blurry");
        
        // Render paper view
        paper.innerHTML = `
            <div style="font-weight:bold;text-align:center;font-size:0.75rem;">HÓA ĐƠN MUA HÀNG</div>
            <div style="text-align:center;margin-bottom:0.4rem;">CÔNG TY CP THỰC PHẨM SẠCH</div>
            <div class="paper-divider"></div>
            <div class="paper-line"><span>MST Bán:</span> <span>${isGood ? '0102030405' : '010203???'}</span></div>
            <div class="paper-line"><span>Ngày Lập:</span> <span>${isGood ? '2026-07-04' : '2026-07-??'}</span></div>
            <div class="paper-divider"></div>
            <div class="paper-line"><span>Hạt Macca 500g x 100 túi</span> <span>10,000,000</span></div>
            <div class="paper-line"><span>Hạt Điều vỏ lụa x 100 hũ</span> <span>5,400,000</span></div>
            <div class="paper-divider"></div>
            <div class="paper-line" style="font-weight:bold;"><span>TỔNG CỘNG (VNĐ)</span> <span>15,400,000</span></div>
        `;

        // Render Review Panel inputs
        const txtTaxCode = document.getElementById("ocr-tax-code");
        const txtDate = document.getElementById("ocr-date");
        const txtTotal = document.getElementById("ocr-total");
        const confidenceBanner = document.getElementById("ocr-confidence-banner");
        const confidenceVal = document.getElementById("ocr-confidence-val");
        
        txtTotal.value = 15400000;
        
        // Remove error classes
        txtTaxCode.classList.remove("error-field");
        txtDate.classList.remove("error-field");

        if (isGood) {
            currentSimulatedInvoiceData = { taxCode: "0102030405", date: "2026-07-04", total: 15400000, confidence: 98, isGood: true };
            confidenceVal.innerText = "98% (Độ tin cậy cao)";
            confidenceBanner.className = "confidence-banner";
            
            txtTaxCode.value = "0102030405";
            txtDate.value = "2026-07-04";
            
            writeOcrLog("SUCCESS", "c.p.service.OcrVisionService", `Nhận diện AI hoàn tất. Kết quả có độ tin cậy 98.2%. Tự động duyệt sang PostgreSQL staging_invoices.`);
        } else {
            currentSimulatedInvoiceData = { taxCode: "", date: "", total: 15400000, confidence: 83, isGood: false };
            confidenceVal.innerText = "83% (Độ tin cậy THẤP - Cần đối soát)";
            confidenceBanner.className = "confidence-banner low-confidence";
            
            txtTaxCode.value = "010203???";
            txtDate.value = "2026-07-??";
            txtTaxCode.classList.add("error-field");
            txtDate.classList.add("error-field");
            
            writeOcrLog("WARN", "c.p.service.OcrVisionService", `Cảnh báo: Có trường dữ liệu mờ, độ tin cậy 83.1% < 90%. Trạng thái: PENDING_HUMAN_REVIEW.`);
        }
    }, 2000);
}

// Add event listener to clear error class on edit
document.querySelectorAll(".ocr-field").forEach(field => {
    field.addEventListener("input", (e) => {
        if (!e.target.value.includes("?")) {
            e.target.classList.remove("error-field");
        }
    });
});

function approveOcrInvoice() {
    if (!currentSimulatedInvoiceData) return;
    
    const taxCode = document.getElementById("ocr-tax-code").value;
    const date = document.getElementById("ocr-date").value;
    const total = document.getElementById("ocr-total").value;
    
    if (taxCode.includes("?") || date.includes("?") || !taxCode || !date) {
        alert("Vui lòng chỉnh sửa các trường bị mờ (chứa dấu ?) trước khi xác nhận đồng bộ.");
        return;
    }

    // Highlight SQL Save & Sync Paths
    const svg = document.getElementById("architecture-svg");
    svg.querySelectorAll(".flow-line").forEach(line => line.classList.remove("visible"));
    svg.getElementById("path-ocr-db-active").classList.add("visible");
    svg.getElementById("path-core-erp-active").classList.add("visible");

    writeOcrLog("INFO", "c.p.controller.ReviewPanelController", `Kế toán xác nhận dữ liệu đã chỉnh sửa. Bắt đầu ghi bảng staging_invoices và đẩy lên ERP.`);
    
    setTimeout(() => {
        writeOcrLog("INFO", "c.p.repository.StagingInvoiceRepository", `SQL: UPDATE staging_invoices SET vendor_tax_code='${taxCode}', invoice_date='${date}', confidence_score=1.00, status='APPROVED_BY_USER' WHERE id='...'`);
    }, 400);

    setTimeout(() => {
        writeOcrLog("INFO", "c.p.client.ErpSyncClient", `Đẩy yêu cầu tạo hóa đơn công nợ lên ERP: POST /api/v1/purchase/invoice-sync`);
        writeOcrLog("INFO", "c.p.client.ErpSyncClient", `ERP payload: { supplierTaxCode: "${taxCode}", docDate: "${date}", totalValue: ${total} }`);
    }, 900);

    setTimeout(() => {
        writeOcrLog("SUCCESS", "c.p.client.ErpSyncClient", `ERP phản hồi: HTTP 200 OK. Đã tạo hóa đơn và ghi nhận công nợ nhà cung cấp thành công.`);
        document.getElementById("ocr-review-container").classList.add("hidden");
        currentSimulatedInvoiceData = null;
        
        if (currentWeek !== 2) {
            setTimeout(() => {
                resetSvgFlowsAfterSim();
            }, 1000);
        }
    }, 1500);
}

function rejectOcrInvoice() {
    if (!currentSimulatedInvoiceData) return;

    // Highlight Quarantine Path
    const svg = document.getElementById("architecture-svg");
    svg.querySelectorAll(".flow-line").forEach(line => line.classList.remove("visible"));
    svg.getElementById("path-ocr-dlq-active").classList.add("visible");
    svg.getElementById("node-dlq").classList.add("active-highlight");

    writeOcrLog("WARN", "c.p.service.OcrFailureHandler", `Kế toán từ chối duyệt hóa đơn. Di chuyển file vào quarantine-zone (DLQ).`);
    
    setTimeout(() => {
        writeOcrLog("INFO", "c.p.service.OcrFailureHandler", `Lưu tệp lỗi: d:/quarantine-zone/err_invoice_rejected_${Date.now()}.pdf`);
        writeOcrLog("SUCCESS", "c.p.service.OcrFailureHandler", `Ghi nhận log lỗi chi tiết. Kế toán có thể tải lại file sau.`);
        document.getElementById("ocr-review-container").classList.add("hidden");
        currentSimulatedInvoiceData = null;
        
        if (currentWeek !== 5) {
            setTimeout(() => {
                resetSvgFlowsAfterSim();
            }, 1000);
        }
    }, 800);
}

function writeOcrLog(level, category, message) {
    const logBox = document.getElementById("ocr-logs");
    const line = document.createElement("div");
    line.className = `log-line ${level.toLowerCase()}`;
    line.innerHTML = `<span class="timestamp">${consoleTimestamps()}</span> <span class="log-level">[${level}]</span> <span class="log-cat">${category}</span> : ${message}`;
    logBox.appendChild(line);
    logBox.scrollTop = logBox.scrollHeight;
}

// 7. Simulator 3: Spring Batch Job
function runBatchSimulation() {
    const btn = document.getElementById("btn-trigger-batch");
    const progressBar = document.getElementById("batch-progress-bar");
    const progressText = document.getElementById("batch-progress-text");
    const statusText = document.getElementById("batch-status-text");
    const ramText = document.getElementById("batch-ram-text");
    const logBox = document.getElementById("batch-logs");

    btn.disabled = true;
    logBox.innerHTML = ""; // Clear logs
    progressBar.style.width = "0%";
    
    statusText.innerText = "RUNNING";
    statusText.className = "metric-value status-running";

    // Highlight SVG Batch Flow paths
    const svg = document.getElementById("architecture-svg");
    const flowPaths = ["path-batch-db-active", "path-batch-h2-active", "path-batch-erp-active"];
    const flowNodes = ["node-spring-batch", "node-postgres", "node-h2", "node-erp"];
    
    flowPaths.forEach(p => {
        const el = svg.getElementById(p);
        if (el) el.classList.add("visible");
    });
    flowNodes.forEach(n => {
        const el = svg.getElementById(n);
        if (el) el.classList.add("active-highlight");
    });

    writeBatchLog("INFO", "o.s.b.c.l.support.SimpleJobLauncher", "Bắt đầu chạy Job [pos-to-erp-sync-job] với parameter: {date=" + new Date().toISOString().substring(0, 10) + "}");
    writeBatchLog("INFO", "o.s.batch.core.job.SimpleStepHandler", "Chạy Step: [syncStep]");
    writeBatchLog("INFO", "c.p.batch.RepositoryItemReader", "Đã khởi tạo Reader phân trang. PageSize = 100.");

    let processed = 0;
    const total = 10000;
    const intervalTime = 120; // ms

    const interval = setInterval(() => {
        processed += 1000; // Increment of 1000 items
        const percent = (processed / total) * 100;
        
        progressBar.style.width = `${percent}%`;
        progressText.innerText = `${processed.toLocaleString()} / 10,000`;
        
        // Simulating highly-optimized memory usage fluctuating between 22MB and 45MB
        const ramUsed = Math.floor(Math.random() * 25 + 20);
        ramText.innerText = `${ramUsed} MB`;

        writeBatchLog("INFO", "o.s.batch.core.step.AbstractStep", 
            `Chunk processed: Đọc & xử lý thành công 1000 items. Gửi Feign Client ghi hàng loạt lên ERP. RAM: ${ramUsed}MB`);

        if (processed >= total) {
            clearInterval(interval);
            
            statusText.innerText = "COMPLETED";
            statusText.className = "metric-value status-completed";
            
            writeBatchLog("INFO", "o.s.batch.core.step.AbstractStep", "Step [syncStep] thực thi thành công. Đã sync 10,000 bản ghi.");
            writeBatchLog("INFO", "o.s.b.c.l.support.SimpleJobLauncher", "Job [pos-to-erp-sync-job] kết thúc thành công với trạng thái: COMPLETED (Time: 2.12s)");
            
            btn.disabled = false;

            if (currentWeek !== 4) {
                setTimeout(() => {
                    resetSvgFlowsAfterSim();
                }, 1500);
            }
        }
    }, intervalTime);
}

function writeBatchLog(level, category, message) {
    const logBox = document.getElementById("batch-logs");
    const line = document.createElement("div");
    line.className = `log-line ${level.toLowerCase()}`;
    line.innerHTML = `<span class="timestamp">${consoleTimestamps()}</span> <span class="log-level">[${level}]</span> <span class="log-cat">${category}</span> : ${message}`;
    logBox.appendChild(line);
    logBox.scrollTop = logBox.scrollHeight;
}

// 8. Helper Functions
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function resetSvgFlowsAfterSim() {
    if (selectedNodeId) {
        // Keep current selected node flow visible
        const conn = nodeFlowConnections[selectedNodeId];
        const svg = document.getElementById("architecture-svg");
        
        svg.querySelectorAll(".node").forEach(n => {
            n.classList.remove("active-highlight");
            n.classList.remove("selected");
        });
        svg.querySelectorAll(".flow-line").forEach(l => {
            l.classList.remove("visible");
        });

        const targetNode = svg.getElementById(selectedNodeId);
        if (targetNode) targetNode.classList.add("selected");

        if (conn) {
            conn.nodes.forEach(nId => {
                const n = svg.getElementById(nId);
                if (n) n.classList.add("active-highlight");
            });
            conn.paths.forEach(pId => {
                const p = svg.getElementById(pId);
                if (p) p.classList.add("visible");
            });
        }
    } else {
        // Re-apply static state for the current active week
        const data = weekData[currentWeek];
        updateSvgHighlights(data.highlights);
    }
}

function toggleNodeSelection(nodeId) {
    const svg = document.getElementById("architecture-svg");
    
    if (selectedNodeId === nodeId) {
        clearNodeSelection();
        return;
    }

    selectedNodeId = nodeId;

    // Reset all nodes and paths
    svg.querySelectorAll(".node").forEach(n => {
        n.classList.remove("active-highlight");
        n.classList.remove("selected");
    });
    svg.querySelectorAll(".flow-line").forEach(l => {
        l.classList.remove("visible");
    });

    // Highlight the selected node itself
    const targetNode = svg.getElementById(nodeId);
    if (targetNode) {
        targetNode.classList.add("selected");
    }

    // Highlight the connected nodes and paths
    const connection = nodeFlowConnections[nodeId];
    if (connection) {
        connection.nodes.forEach(nId => {
            const n = svg.getElementById(nId);
            if (n) n.classList.add("active-highlight");
        });
        connection.paths.forEach(pId => {
            const p = svg.getElementById(pId);
            if (p) p.classList.add("visible");
        });
    }
}

function clearNodeSelection() {
    selectedNodeId = null;
    
    // Clear selected styling
    const svg = document.getElementById("architecture-svg");
    svg.querySelectorAll(".node").forEach(n => {
        n.classList.remove("selected");
    });

    // Reset to current week view
    resetSvgFlowsAfterSim();
}

// 9. Copy Code Functionality
function copyCode() {
    const codeText = document.getElementById("code-snippet").textContent;
    navigator.clipboard.writeText(codeText).then(() => {
        const copyBtn = document.querySelector(".copy-btn");
        copyBtn.innerHTML = `<i class="fa-solid fa-check" style="color:var(--color-green)"></i> Copied!`;
        setTimeout(() => {
            copyBtn.innerHTML = `<i class="fa-regular fa-copy"></i> Copy`;
        }, 2000);
    });
}
