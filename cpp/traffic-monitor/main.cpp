#include <algorithm>
#include <chrono>
#include <cstdint>
#include <iostream>
#include <map>
#include <sstream>
#include <string>
#include <vector>

struct EndpointStats {
    std::uint64_t requests = 0;
    std::uint64_t bytes = 0;
    std::chrono::system_clock::time_point lastRequestTime;

};

static std::vector<std::string> split(const std::string& input, char delimiter) {
    std::vector<std::string> parts;
    std::string current;
    std::istringstream stream(input);

    while (std::getline(stream, current, delimiter)) {
        parts.push_back(current);
    }

    return parts;
}

static std::string trim(const std::string& value) {
    const std::string whitespace = " \t\r\n";
    const auto start = value.find_first_not_of(whitespace);
    if (start == std::string::npos) {
        return "";
    }

    const auto end = value.find_last_not_of(whitespace);
    return value.substr(start, end - start + 1);
}

int main(int argc, char* argv[]) {
    std::uint64_t spikeThreshold = 100;
    std::uint64_t totalRequests = 0;
    std::uint64_t totalBytes = 0;

    for (int i = 1; i < argc; ++i) {
        std::string argument = argv[i];
        if (argument == "--threshold" && i + 1 < argc) {
            spikeThreshold = static_cast<std::uint64_t>(std::stoull(argv[++i]));
        } else if (argument == "--help") {
            std::cout << "Usage: traffic-monitor [--threshold N]\n"
                      << "Read CSV lines from stdin in the format: timestamp,method,path,status,bytes\n"
                      << "Example: 2026-05-21T10:00:00Z,GET,/api/incidents,200,512\n";
            return 0;
        }
    }

    std::map<std::string, EndpointStats> byPath;
    std::string line;

    while (std::getline(std::cin, line)) {
        line = trim(line);
        if (line.empty() || line.front() == '#') {
            continue;
        }

        const std::vector<std::string> fields = split(line, ',');
        if (fields.size() < 5) {
            std::cerr << "Skipping malformed line: " << line << '\n';
            continue;
        }

        const std::string& timestamp = trim(fields[0]);
        if (timestamp.empty()){
            std::cerr << "skipping line with empty timestamp: " << line << '\n';
            continue;
        }

        const std::string method = trim(fields[1]);
        const std::string path = trim(fields[2]);
        const std::string status = trim(fields[3]);
        const std::uint64_t bytes = static_cast<std::uint64_t>(std::stoull(trim(fields[4])));
        const std::string& timestamp = trim(fields[0]);
        const auto timePoint = std::chrono::system_clock::from_time_t(std::chrono::system_clock::to_time_t(std::chrono::system_clock::now())); // Placeholder for actual timestamp parsing
        

        (void)method;
        (void)status;
        (void)timestamp;
        (void)timePoint;

        ++totalRequests;
        totalBytes += bytes;
        byPath[path].requests += 1;
        byPath[path].bytes += bytes;
        byPath[path].lastRequestTime = timePoint;
    }

    std::vector<std::pair<std::string, EndpointStats>> ranked(byPath.begin(), byPath.end());
    std::sort(ranked.begin(), ranked.end(), [](const auto& left, const auto& right) {
        if (left.second.requests == right.second.requests) {
            return left.first < right.first;

        }
        return left.second.requests > right.second.requests;
    });

    std::cout << "Traffic report\n";
    std::cout << "-------------\n";
    std::cout << "Requests: " << totalRequests << '\n';
    std::cout << "Bytes: " << totalBytes << '\n';
    std::cout << ""-------------\n";
    std::cout << "unique endpoints: " << byPath.size() << '\n';
    std::cout << "Top endpoints are ranked by request count\n";
    std::cout << "Endpoints with requests >= threshold are flagged with HIGH_TRAFFIC\n";
    std::cout << "Use --threshold N to set a custom threshold (default is 100 requests)\n";
    std::cout << "Threshold: " << spikeThreshold << " requests\n";

    if (!ranked.empty()) {
        std::cout << "Top endpoints:\n";
        for (std::size_t index = 0; index < std::min<std::size_t>(ranked.size(), 5); ++index) {
            std::cout << "- " << ranked[index].first
                      << " | requests=" << ranked[index].second.requests
                      << " | bytes=" << ranked[index].second.bytes;
            if (ranked[index].second.requests >= spikeThreshold) {
                std::cout << " | alert=HIGH_TRAFFIC";
            }
            std::cout << '\n';
        }
    }

    return 0;
}
