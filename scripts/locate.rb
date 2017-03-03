#!/usr/bin/env ruby

require 'csv'
require 'geocoder'
require 'byebug'

class CsvLocator
  attr_reader :csv_path

  GENERIC_CITY = /National/i

  def initialize(csv_path)
    @csv_path = csv_path
  end

  def process
    table = CSV.table(csv_path)
    table.each do |row|
      rejected = (row[:citystate].nil? || (row[:citystate] =~ GENERIC_CITY))
      location = rejected ? row[:country] : "#{row[:citystate]}, #{row[:country]}"
      lat, long = locate(location)
      row << { lat: lat, long: long, location: location }
    end
    puts table.to_csv
  end

  def locate(query)
    result = Geocoder.search(query).first
    return [nil, nil] if result.nil?
    location = result.geometry['location']
    [location['lat'], location['lng']]
  end
end

CsvLocator.new(ARGV[0]).process
